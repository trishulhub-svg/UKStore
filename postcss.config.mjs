const config = {
  plugins: [
    ["@tailwindcss/postcss", {
      transformAssetUrls: false,
    }],
    require("./postcss-remove-logo-url.js"),
  ],
};

export default config;
