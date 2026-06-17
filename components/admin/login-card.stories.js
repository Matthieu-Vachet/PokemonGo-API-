import { LoginCard } from "./login-card";

export default {
  title: "Admin/LoginCard",
  component: LoginCard,
  tags: ["autodocs"],
};

export const Default = {
  args: {
    password: "",
    error: "",
    loading: false,
    onPasswordChange: () => {},
    onSubmit: () => {},
  },
};
