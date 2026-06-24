import next from "eslint-config-next";
import tseslint from "@typescript-eslint/eslint-plugin";

const config = [
  ...next,
  {
    plugins: { "@typescript-eslint": tseslint },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];

export default config;
