const RT = require("randomthing-js");
let tempKey = null;
function SRK() {
	if (tempKey === null) {
		tempKey = RT.number_en(64);
	}
	return tempKey
}
function SLEEP(delay = 0) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(true)
		}, delay);
	})
}
exports.spawnRandomKey = SRK;
exports.sleep = SLEEP;
