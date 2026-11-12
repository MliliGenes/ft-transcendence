# 0016. Run one Game service instance for the initial release

The live 2v2 flow was verified with one Game service instance; several instances have not been tested together. Run one instance for the initial release and revisit this choice if measured player load or availability needs require more. A multi-instance deployment needs a separate design and tests for cross-instance match coordination, socket event delivery, and recovery.
