"use strict";exports.__esModule=true;exports.writeBuildId=writeBuildId;var _fs=_interopRequireDefault(require("fs"));var _util=require("util");var _path=require("path");var _constants=require("../next-server/lib/constants");function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}const writeFile=(0,_util.promisify)(_fs.default.writeFile);async function writeBuildId(distDir,buildId){const buildIdPath=(0,_path.join)(distDir,_constants.BUILD_ID_FILE);await writeFile(buildIdPath,buildId,'utf8');}