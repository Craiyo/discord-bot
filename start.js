import { exec } from "child_process";

console.log("Booting...");

// Debug command execution
exec("node -v", (err, stdout, stderr) => {
  console.log("Node Version:", stdout);
  if (err) console.error(err);
});

// Start your actual bot
import("./index.js");
