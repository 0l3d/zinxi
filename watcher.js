import { watch } from "fs";

let currentProcess = null;
let restartTimeout = null;

const cMode = process.argv.includes("--c");

const restartProcess = async () => {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }

  if (currentProcess) {
    console.log("Stopping previous process...");
    try {
      currentProcess.kill("SIGTERM");
      await currentProcess.exited;
    } catch (error) {}
    currentProcess = null;
  }

  console.log("Starting new process...");
  try {
    if (cMode) {
      currentProcess = Bun.spawn({
        cmd: ["bun", "run", "ctest"],
        stdout: "inherit",
        stderr: "inherit",
      });
    } else {
      currentProcess = Bun.spawn({
        cmd: ["bun", "run", "test"],
        stdout: "inherit",
        stderr: "inherit",
      });
    }

    currentProcess.exited
      .then(() => {
        if (currentProcess) {
          console.log("Process exited");
          currentProcess = null;
        }
      })
      .catch((error) => {
        console.error("Process error:", error);
        currentProcess = null;
      });
  } catch (error) {
    console.error("Failed to start process:", error);
    currentProcess = null;
  }
};

const watcher = watch(
  `${import.meta.dir}/src`,
  { recursive: true },
  async (event, filename) => {
    console.log(`Detected ${event} in ${filename}`);

    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }

    restartTimeout = setTimeout(() => {
      restartProcess();
    }, 100);
  },
);

restartProcess();

process.on("SIGINT", () => {
  console.log("Closing watcher...");

  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  if (currentProcess) {
    try {
      currentProcess.kill("SIGTERM");
    } catch (error) {}
  }

  watcher.close();
  process.exit(0);
});
