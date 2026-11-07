import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Widgets/features used by a single consumer are kept as separate slices on purpose
    // (clear UI blocks; merging them would bloat the pages).
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
]);
