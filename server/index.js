const { start } = require('../backend/server');

start().catch((error) => {
	console.error(`Startup failed: ${error.message}`);
	process.exitCode = 1;
});
