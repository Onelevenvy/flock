module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "unused-imports", "react", "react-hooks", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "next/core-web-vitals",
    "prettier" // 确保这个在最后
  ],
  rules: {
    // 基本规则
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
    ],

    // React 相关规则
    "react/prop-types": "off", // 如果使用 TypeScript，可以关闭这个规则
    "react/react-in-jsx-scope": "off", // 对于 Next.js 项目，不需要在每个文件中导入 React
    "react/jsx-filename-extension": ["warn", { "extensions": [".tsx"] }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // 导入顺序规则
    "import/order": [
      "error",
      {
        "groups": ["builtin", "external", "internal", ["parent", "sibling"], "index"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true }
      }
    ],
    "import/no-unresolved": "error",
    "import/named": "error",
    "import/default": "error",
    "import/namespace": "error",

    // TypeScript 特定规则
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",

    // 其他常用规则
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": ["error"],
    "padding-line-between-statements": [
      "error",
      { "blankLine": "always", "prev": "*", "next": "return" },
      { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*"},
      { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"]}
    ]
  },
  settings: {
    "react": {
      "version": "detect"
    },
    "import/resolver": {
      "typescript": {} // 这会使用 tsconfig.json 中的路径
    }
  }
};
