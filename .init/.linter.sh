#!/bin/bash
cd /home/kavia/workspace/code-generation/ai-code-assistant-for-visual-studio-code-339349-339365/node_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

