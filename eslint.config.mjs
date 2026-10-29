import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "src/lib/supabase/database.types.ts", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Secrets must never reach client bundles: forbid reading server-only env vars in client components.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/SERVICE_ROLE/]",
          message: "Service-role keys may only be read in `server-only` modules under src/lib/server/ (allow-listed below when added).",
        },
      ],
    },
  },
];

export default config;
