// api/index.ts
import { app } from "../src/app.ts";
import { connectDB } from "../src/config/db.ts";
var index_default = async (req, res) => {
  try {
    console.log("[api/index] Calling connectDB");
    await connectDB();
    console.log("[api/index] connectDB successful");
    return app(req, res);
  } catch (error) {
    console.error("Serverless function invocation failed:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error (Function Invocation Failed)",
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : void 0
    });
  }
};
export {
  index_default as default
};
