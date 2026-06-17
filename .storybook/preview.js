import "../app/globals.css";

const preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "night",
      values: [
        { name: "night", value: "#07111f" },
        { name: "day", value: "#eef4ff" },
      ],
    },
  },
};

export default preview;
