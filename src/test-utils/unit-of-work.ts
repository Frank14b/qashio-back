import { UnitOfWorkPort } from '@/shared/database/unit-of-work.port';

/** Runs the work directly: unit tests mock repositories, so there is no DB transaction. */
export const inlineUnitOfWork: UnitOfWorkPort = {
  run: (work) => work(),
};
