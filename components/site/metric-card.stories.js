import { MetricCard } from "./metric-card";

export default {
  title: "Site/MetricCard",
  component: MetricCard,
  tags: ["autodocs"],
};

export const Default = {
  args: {
    label: "Fiches analysées",
    value: 1602,
  },
};

export const Accent = {
  args: {
    label: "Problèmes",
    value: 17,
    accent: "amber",
  },
};
