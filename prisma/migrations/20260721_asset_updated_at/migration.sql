-- Cache-version columns: images are now served from /api/... with immutable
-- caching, and the URL carries updatedAt so replacing an image busts the cache.
ALTER TABLE "Athlete" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Announcement" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
