import app from "./app.js";
import { env } from "./lib/env.js";

app.listen(env.PORT, () => {
  console.log(`Repo Guardian API listening on http://localhost:${env.PORT}`);
});
