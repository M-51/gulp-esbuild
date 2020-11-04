import {Transform} from 'stream'
import esbuild from 'esbuild'
import PluginError from 'plugin-error'
import Vinyl from 'vinyl'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const {name: PLUGIN_NAME} = require('./package.json')
const {build} = esbuild

export default function(options = {}) {
	const entries = []

	return new Transform({
		objectMode: true,
		transform(file, _, cb) {
			if (!file.isBuffer()) {
				return cb(new PluginError(PLUGIN_NAME, new TypeError('file should be a buffer')))
			}

			entries.push(file)
			cb(null)
		},
		async flush(cb) {
			const commonParams = {
				logLevel: 'silent',
				...options,
				write: false,
			}

			for (const entry of entries) {
				const baseName = entry.stem
				const params = {
					...commonParams,
					stdin: {
						contents: entry.contents.toString(),
						resolveDir: entry.dirname,
						loader: entry.extname.slice(1),
						sourcefile: entry.path,
					},
				}

				let outputFiles

				try {
					({outputFiles} = await build(params))
				} catch(err) {
					return cb(new PluginError(PLUGIN_NAME, err, {
						showProperties: false,
					}))
				}

				outputFiles.forEach(file => {
					this.push(new Vinyl({
						path: file.path.replace('stdin', baseName),
						contents: Buffer.from(file.contents),
					}))
				})
			}

			cb(null)
		},
	})
}
