/** @type {import('@storybook/react-webpack5').StorybookConfig} */
const config = {
  stories: ["../components/**/*.stories.@(js|jsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  webpackFinal: async (config) => {
    config.module.rules.push({
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      use: {
        loader: require.resolve("babel-loader"),
        options: {
          presets: [
            require.resolve("@babel/preset-env"),
            [
              require.resolve("@babel/preset-react"),
              { runtime: "automatic" },
            ],
          ],
        },
      },
    });
    config.resolve.extensions = [
      ...(config.resolve.extensions || []),
      ".js",
      ".jsx",
    ];
    return config;
  },
};

module.exports = config;
