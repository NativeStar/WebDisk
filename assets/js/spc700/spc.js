var Module = typeof Module !== "undefined" ? Module : {};
null;
(function() {
    var _window, _window$SMWCentral, _window$SMWCentral2, _window$SMWCentral2$S;
    (_window$SMWCentral = (_window = window).SMWCentral) !== null && _window$SMWCentral !== void 0 ? _window$SMWCentral : _window.SMWCentral = {};
    (_window$SMWCentral2$S = (_window$SMWCentral2 = window.SMWCentral).SPCPlayer) !== null && _window$SMWCentral2$S !== void 0 ? _window$SMWCentral2$S : _window$SMWCentral2.SPCPlayer = {};
    SMWCentral.SPCPlayer.Backend = function() {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        return {
            status: AudioContext == null || window.Uint8Array == null || window.WebAssembly == null ? -2 : 0,
            locked: false,
            context: null,
            gainNode: null,
            scriptProcessorNode: null,
            rateRatio: 0,
            lastSample: 0,
            bufferPointer: 0,
            bufferSize: 0,
            spcPointer: null,
            channelBuffers: [new Float32Array(16384), new Float32Array(16384)],
            timeoutID: 0,
            hasNewChannelData: false,
            startedAt: 0,
            initialize: function initialize() {
                if (this.status !== 0) {
                    return
                }
                this.context = new AudioContext;
                this.gainNode = this.context.createGain();
                this.rateRatio = 32e3 / this.context.sampleRate;
                this.lastSample = 1 + Math.floor(16384 * this.rateRatio);
                this.bufferSize = 4 * (this.lastSample - 1);
                this.bufferPointer = Module._malloc(this.bufferSize + 4);
                this.playSPC = this.playSPC.bind(this);
                this.copyBuffers = this.copyBuffers.bind(this);
                this.gainNode.connect(this.context.destination);
                this.status = 1
            },
            loadSPC: function loadSPC(spc) {
                var _this$scriptProcessor;
                var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
                if (this.status !== 1) {
                    throw new TypeError("Cannot play SPC right now")
                }
                this.stopSPC(false);
                (_this$scriptProcessor = this.scriptProcessorNode) === null || _this$scriptProcessor === void 0 ? void 0 : _this$scriptProcessor.disconnect(this.gainNode);
                window.clearInterval(this.timeoutID);
                this.spcPointer = Module._malloc(spc.length * Uint8Array.BYTES_PER_ELEMENT);
                Module.HEAPU8.set(spc, this.spcPointer);
                Module._loadSPC(this.spcPointer, spc.length * Uint8Array.BYTES_PER_ELEMENT);
                if (time > 0) {
                    Module._skipSPC(time)
                }
                this.playSPC();
                this.scriptProcessorNode = this.context.createScriptProcessor(this.channelBuffers[0].length, 0, this.channelBuffers.length);
                this.scriptProcessorNode.onaudioprocess = this.copyBuffers;
                this.startedAt = this.context.currentTime - Math.max(0, time);
                this.scriptProcessorNode.connect(this.gainNode);
                this.resume()
            },
            stopSPC: function stopSPC() {
                var pause = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
                if (pause) {
                    this.pause()
                }
                if (this.spcPointer !== null) {
                    Module._free(this.spcPointer);
                    this.spcPointer = null
                }
            },
            pause: function pause() {
                if (this.context != null) {
                    this.context.suspend()
                }
            },
            resume: function resume() {
                if (this.context != null) {
                    this.context.resume()
                }
            },
            getTime: function getTime() {
                return this.context == null ? 0 : this.context.currentTime - this.startedAt
            },
            getVolume: function getVolume() {
                return this.gainNode == null ? 1 : Math.min(Math.max(this.gainNode.gain.value, 0), 1.5)
            },
            setVolume: function setVolume(volume) {
                var duration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
                if (this.gainNode === null) {
                    return
                }
                if (duration <= .02) {
                    this.gainNode.gain.setValueAtTime(Math.min(Math.max(volume, 0), 1.5), this.context.currentTime)
                } else {
                    this.gainNode.gain.exponentialRampToValueAtTime(Math.min(Math.max(volume, .01), 1.5), this.context.currentTime + duration)
                }
            },
            getSample: function getSample(channel, index) {
                var offset = this.rateRatio * index;
                var bufferOffset = Math.floor(offset);
                if (bufferOffset + 1 > this.lastSample) {
                    throw new RangeError("Buffer overflow for sample ".concat(index, " in channel ").concat(channel))
                }
                var high = offset - bufferOffset;
                var low = 1 - high;
                var lowValue = Module.HEAP16[channel + this.bufferPointer / 2 + bufferOffset * 2] * low;
                var highValue = Module.HEAP16[channel + this.bufferPointer / 2 + (bufferOffset + 1) * 2] * high;
                return lowValue + highValue
            },
            playSPC: function playSPC() {
                var channelBuffers = this.channelBuffers;
                Module._playSPC(this.bufferPointer, this.lastSample * 2);
                for (var channel = 0; channel < channelBuffers.length; channel += 1) {
                    var buffer = channelBuffers[channel];
                    for (var index = 0; index < buffer.length; index++) {
                        buffer[index] = this.getSample(channel, index) / 32e3
                    }
                }
                this.hasNewChannelData = true
            },
            copyBuffers: function copyBuffers(_ref) {
                var outputBuffer = _ref.outputBuffer;
                if (this.spcPointer === null || this.context.state !== "running") {
                    return
                }
                if (!this.hasNewChannelData) {
                    window.clearTimeout(this.timeoutID);
                    this.playSPC()
                }
                for (var channel = 0; channel < outputBuffer.numberOfChannels; channel += 1) {
                    outputBuffer.copyToChannel(this.channelBuffers[channel], channel, 0)
                }
                this.hasNewChannelData = false;
                window.clearTimeout(this.timeoutID);
                this.timeoutID = window.setTimeout(this.playSPC, 0)
            },
            unlock: function unlock() {
                if (this.locked && this.context != null) {
                    this.context.resume();
                    this.locked = false
                }
            }
        }
    }()
}
)();
null;
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        enumerableOnly && (symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable
        })),
        keys.push.apply(keys, symbols)
    }
    return keys
}
function _objectSpread(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = null != arguments[i] ? arguments[i] : {};
        i % 2 ? ownKeys(Object(source), !0).forEach(function(key) {
            _defineProperty(target, key, source[key])
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key))
        })
    }
    return target
}
function _defineProperty(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        })
    } else {
        obj[key] = value
    }
    return obj
}
(function() {
    var _SMWCentral$SPCPlayer, _SMWCentral$SPCPlayer2, _SMWCentral$SPCPlayer3, _SMWCentral$SPCPlayer4, _SMWCentral$SPCPlayer5, _SMWCentral$SPCPlayer6, _SMWCentral$SPCPlayer7, _SMWCentral$SPCPlayer8, _SMWCentral$SPCPlayer9, _SMWCentral$SPCPlayer10, _SMWCentral$SPCPlayer11, _SMWCentral$SPCPlayer12, _SMWCentral$SPCPlayer13, _SMWCentral$SPCPlayer14;
    (_SMWCentral$SPCPlayer2 = (_SMWCentral$SPCPlayer = SMWCentral.SPCPlayer).onPlay) !== null && _SMWCentral$SPCPlayer2 !== void 0 ? _SMWCentral$SPCPlayer2 : _SMWCentral$SPCPlayer.onPlay = function() {}
    ;
    (_SMWCentral$SPCPlayer4 = (_SMWCentral$SPCPlayer3 = SMWCentral.SPCPlayer).onPause) !== null && _SMWCentral$SPCPlayer4 !== void 0 ? _SMWCentral$SPCPlayer4 : _SMWCentral$SPCPlayer3.onPause = function() {}
    ;
    (_SMWCentral$SPCPlayer6 = (_SMWCentral$SPCPlayer5 = SMWCentral.SPCPlayer).onRestart) !== null && _SMWCentral$SPCPlayer6 !== void 0 ? _SMWCentral$SPCPlayer6 : _SMWCentral$SPCPlayer5.onRestart = function() {}
    ;
    (_SMWCentral$SPCPlayer8 = (_SMWCentral$SPCPlayer7 = SMWCentral.SPCPlayer).onStop) !== null && _SMWCentral$SPCPlayer8 !== void 0 ? _SMWCentral$SPCPlayer8 : _SMWCentral$SPCPlayer7.onStop = function() {}
    ;
    (_SMWCentral$SPCPlayer10 = (_SMWCentral$SPCPlayer9 = SMWCentral.SPCPlayer).onEnd) !== null && _SMWCentral$SPCPlayer10 !== void 0 ? _SMWCentral$SPCPlayer10 : _SMWCentral$SPCPlayer9.onEnd = function() {}
    ;
    (_SMWCentral$SPCPlayer12 = (_SMWCentral$SPCPlayer11 = SMWCentral.SPCPlayer).onError) !== null && _SMWCentral$SPCPlayer12 !== void 0 ? _SMWCentral$SPCPlayer12 : _SMWCentral$SPCPlayer11.onError = function(error) {
        return window.alert(error)
    }
    ;
    (_SMWCentral$SPCPlayer14 = (_SMWCentral$SPCPlayer13 = SMWCentral.SPCPlayer).createPlaylistItem) !== null && _SMWCentral$SPCPlayer14 !== void 0 ? _SMWCentral$SPCPlayer14 : _SMWCentral$SPCPlayer13.createPlaylistItem = function(song, filename, index) {
        var item = document.createElement("li");
        item.innerText = filename;
        if (song.index === index) {
            item.classList.add("playing")
        }
        return item
    }
    ;
    function createSPCPlayerUI() {
        var SPCPlayer = window.SMWCentral.SPCPlayer.Backend;
        var volume = Number(sessionStorage.getItem("spc_volume") || 1);
        var finished = false;
        var timer = {
            lastUpdatedUI: -1,
            target: 0,
            finish: 0,
            fade: 0,
            element: null
        };
        if (Number.isNaN(volume)) {
            volume = 1
        }
        var updateVolume = function updateVolume() {
            var event = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
            if (event instanceof MouseEvent) {
                var range = event.target.clientWidth;
                var position = Math.min(Math.max(event.offsetX, 0), range);
                volume = 1.5 * position / range;
                if (Math.abs(volume - 1.5) < .05) {
                    volume = 1.5
                } else if (Math.abs(volume - 1) < .05) {
                    volume = 1
                } else if (Math.abs(volume - .5) < .025) {
                    volume = .5
                }
            }
            volume = Math.min(Math.max(volume, 0), 1.5);
            SPCPlayer.setVolume(volume, Math.abs(SPCPlayer.getVolume() - volume) * .5);
        };
        var loadSong = function loadSong(song) {
            var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
            if (SPCPlayer.status < 0) {
                SMWCentral.SPCPlayer.onError("Couldn't load SPC player.");
                return
            }
            if (SPCPlayer.status !== 1) {
                setTimeout(function() {
                    return loadSong(song, time)
                }, 15);
                return
            }
            if (song == null) {
                document.body.classList.remove("fetching-song");
                SMWCentral.SPCPlayer.onError("Couldn't read SPC file.");
                return
            }
            finished = false;
            timer.finish = 0;
            if (typeof song.data === "string" && song.spc == null) {
                var spc = window.atob(song.data);
                var spcLength = spc.length;
                var data = new Uint8Array(new ArrayBuffer(spcLength));
                for (var index = 0; index < spcLength; index += 1) {
                    data[index] = spc.charCodeAt(index)
                }
                song.spc = data.buffer
            }
            SPCPlayer.loadSPC(new Uint8Array(song.spc), time);
            updateVolume();
            var aside = [];
            if (song.duration > 0) {
                timer.target = song.duration;
                timer.fade = song.fade;
                var seconds = song.duration % 60;
                aside.push("".concat(Math.floor(song.duration / 60), ":").concat(seconds > 9 ? "" : "0").concat(seconds, " minutes"))
            } else {
                timer.target = 0
            }
            if (song.date.trim().length > 0) {
                aside.push("exported on ".concat(song.date))
            }
            if (song.files.length > 1) {
                var files = song.files;
                var common = files[0].length;
                for (var i = 1; i < files.length; i++) {
                    var position = 0;
                    for (; position < common && position < files[i].length && files[0][position] === files[i][position]; position++) {}
                    common = position
                }
            } else {
                // playlist.style.display = "none"
            }
            currentSong = song;
        };
        var updateTimer = function updateTimer() {
            if (timer.target <= 0 || SPCPlayer.status !== 1 || SPCPlayer.spcPointer === null) {
                return
            }
            var time = SPCPlayer.getTime();
            if (!finished && timer.finish > 0 && time >= timer.finish) {
                finished = true;
                SPCPlayer.stopSPC();
                SMWCentral.SPCPlayer.onEnd();
                return
            }
        };
        var extractString = function extractString(bytes, start, length) {
            var realLength;
            for (realLength = 0; realLength < length && bytes[start + realLength] !== 0; realLength += 1) {}
            return new TextDecoder("latin1").decode(bytes.slice(start, start + realLength))
        };
        var parseSPC = function parseSPC(spc) {
            var array = new Uint8Array(spc);
            return {
                title: extractString(array, 46, 32) || "SPC File",
                game: extractString(array, 78, 32),
                comment: extractString(array, 126, 32),
                date: extractString(array, 158, 10),
                duration: Number(extractString(array, 169, 3)),
                fade: Number(extractString(array, 172, 4)),
                author: extractString(array, 177, 32)
            }
        };
        var loadSPC = function loadSPC(spc) {
            var data = parseSPC(spc);
            return loadSong(_objectSpread(_objectSpread({
                index: 0,
                files: [data.title],
                filename: data.title
            }, data), {}, {
                spc: spc
            }))
        };
        updateVolume();
        document.body.addEventListener("click", function() {
            SPCPlayer.unlock()
        });
        setInterval(updateTimer, 500);
        // requestAnimationFrame(updateUI);
        SMWCentral.SPCPlayer.parseSPC = parseSPC;
        SMWCentral.SPCPlayer.loadSong = loadSong;
        SMWCentral.SPCPlayer.loadSPC = loadSPC;
        SMWCentral.SPCPlayer.loadFromLink = function(link) {
            var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
            return fetch(link.href, options).then(function(response) {
                return response.arrayBuffer()
            }).then(loadSPC)
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createSPCPlayerUI)
    } else {
        createSPCPlayerUI()
    }
}
)();
var moduleOverrides = {};
var key;
for (key in Module) {
    if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key]
    }
}
var arguments_ = [];
var thisProgram = "./this.program";
var quit_ = function(status, toThrow) {
    throw toThrow
};
var ENVIRONMENT_IS_WEB = true;
var ENVIRONMENT_IS_WORKER = false;
var scriptDirectory = "";
function locateFile(path) {
    if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory)
    }
    return scriptDirectory + path
}
var read_, readAsync, readBinary, setWindowTitle;
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href
    } else if (document.currentScript) {
        scriptDirectory = document.currentScript.src
    }
    if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
    } else {
        scriptDirectory = ""
    }
    {
        read_ = function shell_read(url) {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, false);
            xhr.send(null);
            return xhr.responseText
        }
        ;
        if (ENVIRONMENT_IS_WORKER) {
            readBinary = function readBinary(url) {
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response)
            }
        }
        readAsync = function readAsync(url, onload, onerror) {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function xhr_onload() {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return
                }
                onerror()
            }
            ;
            xhr.onerror = onerror;
            xhr.send(null)
        }
    }
    setWindowTitle = function(title) {
        document.title = title
    }
} else {}
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.warn.bind(console);
for (key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key]
    }
}
moduleOverrides = null;
if (Module["arguments"])
    arguments_ = Module["arguments"];
if (Module["thisProgram"])
    thisProgram = Module["thisProgram"];
if (Module["quit"])
    quit_ = Module["quit"];
var wasmBinary;
if (Module["wasmBinary"])
    wasmBinary = Module["wasmBinary"];
var noExitRuntime;
if (Module["noExitRuntime"])
    noExitRuntime = Module["noExitRuntime"];
if (typeof WebAssembly !== "object") {
    abort("no native wasm support detected")
}
var wasmMemory;
var wasmTable = new WebAssembly.Table({
    "initial": 4,
    "maximum": 4 + 0,
    "element": "anyfunc"
});
var ABORT = false;
var EXITSTATUS = 0;
var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (heap[endPtr] && !(endPtr >= endIdx))
        ++endPtr;
    if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(heap.subarray(idx, endPtr))
    } else {
        var str = "";
        while (idx < endPtr) {
            var u0 = heap[idx++];
            if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue
            }
            var u1 = heap[idx++] & 63;
            if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue
            }
            var u2 = heap[idx++] & 63;
            if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2
            } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63
            }
            if (u0 < 65536) {
                str += String.fromCharCode(u0)
            } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
            }
        }
    }
    return str
}
function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
}
function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0))
        return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx)
                break;
            heap[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx)
                break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx)
                break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx)
                break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx
}
function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343)
            u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127)
            ++len;
        else if (u <= 2047)
            len += 2;
        else if (u <= 65535)
            len += 3;
        else
            len += 4
    }
    return len
}
function allocateUTF8OnStack(str) {
    var size = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(size);
    stringToUTF8Array(str, HEAP8, ret, size);
    return ret
}
var WASM_PAGE_SIZE = 65536;
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateGlobalBufferAndViews(buf) {
    buffer = buf;
    Module["HEAP8"] = HEAP8 = new Int8Array(buf);
    Module["HEAP16"] = HEAP16 = new Int16Array(buf);
    Module["HEAP32"] = HEAP32 = new Int32Array(buf);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buf)
}
var DYNAMIC_BASE = 5248256
  , DYNAMICTOP_PTR = 5216;
var INITIAL_INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;
if (Module["wasmMemory"]) {
    wasmMemory = Module["wasmMemory"]
} else {
    wasmMemory = new WebAssembly.Memory({
        "initial": INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
        "maximum": INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE
    })
}
if (wasmMemory) {
    buffer = wasmMemory.buffer
}
INITIAL_INITIAL_MEMORY = buffer.byteLength;
updateGlobalBufferAndViews(buffer);
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == "function") {
            callback(Module);
            continue
        }
        var func = callback.func;
        if (typeof func === "number") {
            if (callback.arg === undefined) {
                Module["dynCall_v"](func)
            } else {
                Module["dynCall_vi"](func, callback.arg)
            }
        } else {
            func(callback.arg === undefined ? null : callback.arg)
        }
    }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
    if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
            Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPRERUN__)
}
function initRuntime() {
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__)
}
function preMain() {
    callRuntimeCallbacks(__ATMAIN__)
}
function exitRuntime() {
    runtimeExited = true
}
function postRun() {
    if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
            Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
}
function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
}
function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
}
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
}
function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
function abort(what) {
    if (Module["onAbort"]) {
        Module["onAbort"](what)
    }
    what += "";
    err(what);
    ABORT = true;
    EXITSTATUS = 1;
    what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
    var e = new WebAssembly.RuntimeError(what);
    throw e
}
function hasPrefix(str, prefix) {
    return String.prototype.startsWith ? str.startsWith(prefix) : str.indexOf(prefix) === 0
}
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
    return hasPrefix(filename, dataURIPrefix)
}
var wasmBinaryFile = "spc.wasm";
if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile)
}
function getBinary() {
    try {
        if (wasmBinary) {
            return new Uint8Array(wasmBinary)
        }
        if (readBinary) {
            return readBinary(wasmBinaryFile)
        } else {
            throw "both async and sync fetching of the wasm failed"
        }
    } catch (err) {
        abort(err)
    }
}
function getBinaryPromise() {
    if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
        return fetch(wasmBinaryFile, {
            credentials: "same-origin"
        }).then(function(response) {
            if (!response["ok"]) {
                throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
            }
            return response["arrayBuffer"]()
        }).catch(function() {
            return getBinary()
        })
    }
    return new Promise(function(resolve, reject) {
        resolve(getBinary())
    }
    )
}
function createWasm() {
    var info = {
        "a": asmLibraryArg
    };
    function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module["asm"] = exports;
        removeRunDependency("wasm-instantiate")
    }
    addRunDependency("wasm-instantiate");
    function receiveInstantiatedSource(output) {
        receiveInstance(output["instance"])
    }
    function instantiateArrayBuffer(receiver) {
        return getBinaryPromise().then(function(binary) {
            return WebAssembly.instantiate(binary, info)
        }).then(receiver, function(reason) {
            err("failed to asynchronously prepare wasm: " + reason);
            abort(reason)
        })
    }
    function instantiateAsync() {
        if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
            fetch(wasmBinaryFile, {
                credentials: "same-origin"
            }).then(function(response) {
                var result = WebAssembly.instantiateStreaming(response, info);
                return result.then(receiveInstantiatedSource, function(reason) {
                    err("wasm streaming compile failed: " + reason);
                    err("falling back to ArrayBuffer instantiation");
                    return instantiateArrayBuffer(receiveInstantiatedSource)
                })
            })
        } else {
            return instantiateArrayBuffer(receiveInstantiatedSource)
        }
    }
    if (Module["instantiateWasm"]) {
        try {
            var exports = Module["instantiateWasm"](info, receiveInstance);
            return exports
        } catch (e) {
            err("Module.instantiateWasm callback failed with error: " + e);
            return false
        }
    }
    instantiateAsync();
    return {}
}
var ASM_CONSTS = {
    1035: function() {
        SMWCentral.SPCPlayer.Backend.status = -1
    },
    1103: function() {
        try {
            SMWCentral.SPCPlayer.Backend.initialize()
        } catch (error) {
            SMWCentral.SPCPlayer.Backend.status = -1;
            console.error(error)
        }
    }
};
function _emscripten_asm_const_iii(code, sigPtr, argbuf) {
    var args = readAsmConstArgs(sigPtr, argbuf);
    return ASM_CONSTS[code].apply(null, args)
}
__ATINIT__.push({
    func: function() {
        ___wasm_call_ctors()
    }
});
function ___assert_fail(condition, filename, line, func) {
    abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"])
}
function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.copyWithin(dest, src, src + num)
}
function abortOnCannotGrowMemory(requestedSize) {
    abort("OOM")
}
function _emscripten_resize_heap(requestedSize) {
    requestedSize = requestedSize >>> 0;
    abortOnCannotGrowMemory(requestedSize)
}
function _exit(status) {
    exit(status)
}
var PATH = {
    splitPath: function(filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1)
    },
    normalizeArray: function(parts, allowAboveRoot) {
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
                parts.splice(i, 1)
            } else if (last === "..") {
                parts.splice(i, 1);
                up++
            } else if (up) {
                parts.splice(i, 1);
                up--
            }
        }
        if (allowAboveRoot) {
            for (; up; up--) {
                parts.unshift("..")
            }
        }
        return parts
    },
    normalize: function(path) {
        var isAbsolute = path.charAt(0) === "/"
          , trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p
        }), !isAbsolute).join("/");
        if (!path && !isAbsolute) {
            path = "."
        }
        if (path && trailingSlash) {
            path += "/"
        }
        return (isAbsolute ? "/" : "") + path
    },
    dirname: function(path) {
        var result = PATH.splitPath(path)
          , root = result[0]
          , dir = result[1];
        if (!root && !dir) {
            return "."
        }
        if (dir) {
            dir = dir.substr(0, dir.length - 1)
        }
        return root + dir
    },
    basename: function(path) {
        if (path === "/")
            return "/";
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1)
            return path;
        return path.substr(lastSlash + 1)
    },
    extname: function(path) {
        return PATH.splitPath(path)[3]
    },
    join: function() {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join("/"))
    },
    join2: function(l, r) {
        return PATH.normalize(l + "/" + r)
    }
};
var SYSCALLS = {
    mappings: {},
    buffers: [null, [], []],
    printChar: function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0
        } else {
            buffer.push(curr)
        }
    },
    varargs: undefined,
    get: function() {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret
    },
    getStr: function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret
    },
    get64: function(low, high) {
        return low
    }
};
function _fd_close(fd) {
    return 0
}
function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {}
function _fd_write(fd, iov, iovcnt, pnum) {
    var num = 0;
    for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[iov + i * 8 >> 2];
        var len = HEAP32[iov + (i * 8 + 4) >> 2];
        for (var j = 0; j < len; j++) {
            SYSCALLS.printChar(fd, HEAPU8[ptr + j])
        }
        num += len
    }
    HEAP32[pnum >> 2] = num;
    return 0
}
var readAsmConstArgsArray = [];
function readAsmConstArgs(sigPtr, buf) {
    readAsmConstArgsArray.length = 0;
    var ch;
    buf >>= 2;
    while (ch = HEAPU8[sigPtr++]) {
        var double = ch < 105;
        if (double && buf & 1)
            buf++;
        readAsmConstArgsArray.push(double ? HEAPF64[buf++ >> 1] : HEAP32[buf]);
        ++buf
    }
    return readAsmConstArgsArray
}
var asmLibraryArg = {
    "a": ___assert_fail,
    "b": _emscripten_asm_const_iii,
    "f": _emscripten_memcpy_big,
    "g": _emscripten_resize_heap,
    "c": _exit,
    "h": _fd_close,
    "e": _fd_seek,
    "d": _fd_write,
    "memory": wasmMemory,
    "table": wasmTable
};
var asm = createWasm();
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
    return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["i"]).apply(null, arguments)
}
;
var _main = Module["_main"] = function() {
    return (_main = Module["_main"] = Module["asm"]["j"]).apply(null, arguments)
}
;
var _loadSPC = Module["_loadSPC"] = function() {
    return (_loadSPC = Module["_loadSPC"] = Module["asm"]["k"]).apply(null, arguments)
}
;
var _playSPC = Module["_playSPC"] = function() {
    return (_playSPC = Module["_playSPC"] = Module["asm"]["l"]).apply(null, arguments)
}
;
var _skipSPC = Module["_skipSPC"] = function() {
    return (_skipSPC = Module["_skipSPC"] = Module["asm"]["m"]).apply(null, arguments)
}
;
var _malloc = Module["_malloc"] = function() {
    return (_malloc = Module["_malloc"] = Module["asm"]["n"]).apply(null, arguments)
}
;
var _free = Module["_free"] = function() {
    return (_free = Module["_free"] = Module["asm"]["o"]).apply(null, arguments)
}
;
var stackAlloc = Module["stackAlloc"] = function() {
    return (stackAlloc = Module["stackAlloc"] = Module["asm"]["p"]).apply(null, arguments)
}
;
var calledRun;
function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status
}
var calledMain = false;
dependenciesFulfilled = function runCaller() {
    if (!calledRun)
        run();
    if (!calledRun)
        dependenciesFulfilled = runCaller
}
;
function callMain(args) {
    var entryFunction = Module["_main"];
    args = args || [];
    var argc = args.length + 1;
    var argv = stackAlloc((argc + 1) * 4);
    HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
    for (var i = 1; i < argc; i++) {
        HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
    }
    HEAP32[(argv >> 2) + argc] = 0;
    try {
        var ret = entryFunction(argc, argv);
        exit(ret, true)
    } catch (e) {
        if (e instanceof ExitStatus) {
            return
        } else if (e == "unwind") {
            noExitRuntime = true;
            return
        } else {
            var toLog = e;
            if (e && typeof e === "object" && e.stack) {
                toLog = [e, e.stack]
            }
            err("exception thrown: " + toLog);
            quit_(1, e)
        }
    } finally {
        calledMain = true
    }
}
function run(args) {
    args = args || arguments_;
    if (runDependencies > 0) {
        return
    }
    preRun();
    if (runDependencies > 0)
        return;
    function doRun() {
        if (calledRun)
            return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT)
            return;
        initRuntime();
        preMain();
        if (Module["onRuntimeInitialized"])
            Module["onRuntimeInitialized"]();
        if (shouldRunNow)
            callMain(args);
        postRun()
    }
    if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function() {
            setTimeout(function() {
                Module["setStatus"]("")
            }, 1);
            doRun()
        }, 1)
    } else {
        doRun()
    }
}
Module["run"] = run;
function exit(status, implicit) {
    if (implicit && noExitRuntime && status === 0) {
        return
    }
    if (noExitRuntime) {} else {
        ABORT = true;
        EXITSTATUS = status;
        exitRuntime();
        if (Module["onExit"])
            Module["onExit"](status)
    }
    quit_(status, new ExitStatus(status))
}
if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
        Module["preInit"].pop()()
    }
}
var shouldRunNow = true;
if (Module["noInitialRun"])
    shouldRunNow = false;
noExitRuntime = true;
run();
