import { mount } from "svelte";
// import App from "./App.svelte";
import "./style.scss";
import Main from "./Main.svelte";

const app = mount(Main, {
  target: document.getElementById("app")!,
});

export default app;
