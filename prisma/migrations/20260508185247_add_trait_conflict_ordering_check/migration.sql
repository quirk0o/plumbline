-- AddConstraint
ALTER TABLE "personality_trait_conflicts" ADD CONSTRAINT "personality_trait_conflicts_ordering_check" CHECK ("traitAId" < "traitBId");
