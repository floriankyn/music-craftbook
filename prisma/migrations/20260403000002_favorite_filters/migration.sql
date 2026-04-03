ALTER TABLE "Favorite" ADD COLUMN "dateFilter"   TEXT;
ALTER TABLE "Favorite" ADD COLUMN "freeFilter"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Favorite" ADD COLUMN "artistFilter" TEXT;
ALTER TABLE "Favorite" ADD COLUMN "typeBeat"     BOOLEAN NOT NULL DEFAULT false;
