import { isValidObjectId } from 'mongoose';
import { NextResponse } from 'next/server';
import { fail, handleRoute, requireUser } from '@/lib/api';
import { connectToDatabase } from '@/lib/db';
import { ownedActive } from '@/lib/predictions-service';
import { Prediction } from '@/models/Prediction';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await params;

    // Guard before querying: an invalid ObjectId makes Mongoose throw a
    // CastError, which would surface as a 500 rather than a clean 404.
    if (!isValidObjectId(id)) return fail(404, 'Prediction not found');

    await connectToDatabase();

    /*
     * Soft delete: the row is stamped, never removed. Generated numbers are
     * sampled and cannot be reproduced, so a hard delete would be irreversible.
     *
     * Ownership is part of the filter, not a check after the fetch. A prediction
     * belonging to someone else is indistinguishable from one that does not
     * exist, so this cannot be used to probe for other users' records. The
     * `deletedAt: null` term also makes a repeat delete a no-op 404 rather than
     * overwriting the original timestamp.
     */
    const deleted = await Prediction.findOneAndUpdate(
      { _id: id, ...ownedActive(user.id) },
      { $set: { deletedAt: new Date() } },
    );
    if (!deleted) return fail(404, 'Prediction not found');

    return new NextResponse(null, { status: 204 });
  });
}
