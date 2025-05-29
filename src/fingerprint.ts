const Bowser = require('bowser');

class Fingerprint {
	getUserAgent(): Record<string, any> {
		const parser = Bowser.getParser(window.navigator.userAgent);

		return {
			browser: parser.getBrowserName(),
			version: parser.getBrowserVersion(),
			os: parser.getOSName(),
			osVersion: parser.getOSVersion(),
			platform: parser.getPlatformType(),
			engine: parser.getEngineName(),
			raw: parser.getUA(),
		};
	}

	getFonts(): string[] {
		const baseFonts = ['monospace', 'sans-serif', 'serif'];
		const testFonts = [
			// macOS
			'Arial Unicode MS',
			'Gill Sans',
			'Helvetica Neue',
			'Menlo',
			// Windows
			'Segoe UI',
			'Calibri',
			'Cambria',
			'Consolas',
			// Linux
			'Ubuntu',
			'DejaVu Sans',
			'Liberation Sans',
			'Noto Sans',
		];
		const testString = 'mmmmmmmmmmlli';
		const testSize = '72px';
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d')!;
		const defaultWidths: Record<string, number> = {};

		for (const font of baseFonts) {
			context.font = `${testSize} ${font}`;
			const metrics = context.measureText(testString);
			defaultWidths[font] = metrics.width;
		}

		function isFontAvailable(font: string): boolean {
			for (const baseFont of baseFonts) {
				context.font = `${testSize} '${font}',${baseFont}`;
				const metrics = context.measureText(testString);

				if (metrics.width !== defaultWidths[baseFont]) {
					return true;
				}
			}

			return false;
		}

		const fonts: string[] = [];

		for (const font of testFonts) {
			if (isFontAvailable(font)) {
				fonts.push(font);
			}
		}

		return fonts;
	}

	getCanvas(): string {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			return 'Canvas API not supported';
		}

		canvas.width = 200;
		canvas.height = 50;
		ctx.textBaseline = 'top';
		ctx.font = "16px 'Arial'";
		ctx.fillStyle = '#f60';
		ctx.fillRect(125, 1, 62, 20);
		ctx.fillStyle = '#069';
		ctx.fillText('mmmmmmmmmmlli', 2, 15);

		const dataUrl = canvas.toDataURL();

		return dataUrl;
	}

	getPlugins(): string[] {
		if (!navigator.plugins) {
			return [];
		}

		const plugins: string[] = [];

		for (let i = 0; i < navigator.plugins.length; i++) {
			const plugin = navigator.plugins[i];

			plugins.push(
				plugin.name + (plugin.filename ? ` (${plugin.filename})` : ''),
			);
		}

		return plugins;
	}

	getWebGL(): Record<string, any> | null {
		const canvas = document.createElement('canvas');
		const gl = (canvas.getContext('webgl') ||
			canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
		if (!gl) return null;

		const fingerprint: any = {};

		const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
		if (dbgRenderInfo) {
			fingerprint.vendor = gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL);
			fingerprint.renderer = gl.getParameter(
				dbgRenderInfo.UNMASKED_RENDERER_WEBGL,
			);
		}

		fingerprint.version = gl.getParameter(gl.VERSION);
		fingerprint.shadingLanguageVersion = gl.getParameter(
			gl.SHADING_LANGUAGE_VERSION,
		);

		fingerprint.extensions = gl.getSupportedExtensions() || [];

		const paramNames = [
			'MAX_VERTEX_ATTRIBS',
			'MAX_VERTEX_UNIFORM_VECTORS',
			'MAX_FRAGMENT_UNIFORM_VECTORS',
			'MAX_TEXTURE_SIZE',
			'MAX_CUBE_MAP_TEXTURE_SIZE',
			'MAX_RENDERBUFFER_SIZE',
			'MAX_VIEWPORT_DIMS',
			'ALIASED_POINT_SIZE_RANGE',
			'ALIASED_LINE_WIDTH_RANGE',
		];
		fingerprint.params = {};
		for (const name of paramNames) {
			fingerprint.params[name] = gl.getParameter((gl as any)[name]);
		}

		try {
			gl.clearColor(0.6, 0.2, 0.8, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			const pixels = new Uint8Array(64 * 64 * 4);
			gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			let hash = 0;
			for (const v of pixels) {
				hash = (hash << 5) - hash + v;
				hash |= 0;
			}
			fingerprint.pixelsHash = hash.toString();
		} catch (e) {
			fingerprint.pixelsHash = undefined;
		}

		return fingerprint;
	}

	async getAudio(): Promise<Record<string, any>> {
		const AudioContext =
			window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
		if (!AudioContext) {
			return { supported: false };
		}
		const context = new AudioContext(1, 44100, 44100);
		const oscillator = context.createOscillator();
		oscillator.type = 'triangle';
		oscillator.frequency.value = 10000;
		const compressor = context.createDynamicsCompressor();
		compressor.threshold.value = -50;
		compressor.knee.value = 40;
		compressor.ratio.value = 12;
		compressor.attack.value = 0;
		compressor.release.value = 0.25;

		oscillator.connect(compressor);
		compressor.connect(context.destination);

		oscillator.start(0);
		context.startRendering();

		return new Promise<Record<string, any>>((resolve) => {
			context.oncomplete = (event: OfflineAudioCompletionEvent) => {
				const buffer = event.renderedBuffer;
				const data = buffer.getChannelData(0);
				const segment = data.slice(4500, 5000);
				const sum = segment.reduce((acc, val) => acc + Math.abs(val), 0);

				resolve({
					supported: true,
					sampleRate: buffer.sampleRate,
					renderLength: buffer.length,
					fingerprint: sum.toString(),
					compressorParams: {
						threshold: compressor.threshold.value,
						knee: compressor.knee.value,
						ratio: compressor.ratio.value,
						attack: compressor.attack.value,
						release: compressor.release.value,
					},
				});
			};
		});
	}

	getNetwork(): Record<string, any> {
		const connection =
			(navigator as any).connection ||
			(navigator as any).mozConnection ||
			(navigator as any).webkitConnection;
		return {
			downlink: connection?.downlink,
			effectiveType: connection?.effectiveType,
			rtt: connection?.rtt,
			saveData: connection?.saveData,
			type: connection?.type,
			online: navigator.onLine,
		};
	}

	async collect(): Promise<Record<string, any>> {
		return {
			userAgent: this.getUserAgent(),
			fonts: this.getFonts(),
			canvas: this.getCanvas(),
			plugins: this.getPlugins(),
			webgl: this.getWebGL(),
			audio: await this.getAudio(),
			network: this.getNetwork(),
		};
	}

	async generate(): Promise<string> {
		const data = this.collect();
		const serialized = JSON.stringify(data);
		const encoder = new TextEncoder();
		const buffer = encoder.encode(serialized);
		const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	async render(containerId: string = 'output') {
		const container = document.getElementById(containerId);
		if (!container) {
			console.error(`Контейнер с id="${containerId}" не найден`);
			return;
		}

		container.innerHTML = '';

		const data = await this.collect();

		for (const [key, value] of Object.entries(data)) {
			const section = document.createElement('div');
			section.className = 'section';

			const title = document.createElement('h2');
			title.textContent = key;
			section.appendChild(title);

			const pre = document.createElement('pre');
			pre.textContent = JSON.stringify(value, null, 2);
			section.appendChild(pre);

			container.appendChild(section);
		}

		const hash = await this.generate();
		const hashSection = document.createElement('div');
		hashSection.className = 'section';

		const hashTitle = document.createElement('h2');
		hashTitle.textContent = 'Hash';
		hashSection.appendChild(hashTitle);

		const hashPre = document.createElement('pre');
		hashPre.textContent = hash;
		hashSection.appendChild(hashPre);

		container.appendChild(hashSection);
	}
}

const fp = new Fingerprint();
fp.render();
