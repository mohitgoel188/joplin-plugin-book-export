/* global mermaid, webviewApi */
/**
 * Runs inside the export progress dialog. Pulls the diagram job from the plugin,
 * renders each Mermaid source with the bundled mermaid library, and posts the
 * results back: SVG markup for HTML books, PNG (base64) for EPUB books.
 *
 * PNG rendering turns HTML labels off: mermaid otherwise draws labels inside
 * <foreignObject>, which taints the canvas here and which e-ink readers cannot draw.
 */
(function () {
	const PNG_SCALE = 2;
	const status = (text) => {
		const el = document.getElementById('book-export-status');
		if (el) el.textContent = text;
	};

	function svgSize(svg) {
		const box = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
		if (box.length === 4 && box[2] > 0 && box[3] > 0) return { width: box[2], height: box[3] };
		const rect = svg.getBoundingClientRect();
		return { width: rect.width || 800, height: rect.height || 600 };
	}

	function toPng(svgMarkup) {
		const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
		const svg = doc.documentElement;
		const { width, height } = svgSize(svg);
		svg.setAttribute('width', String(width));
		svg.setAttribute('height', String(height));
		svg.removeAttribute('style');
		const xml = new XMLSerializer().serializeToString(svg);
		const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				canvas.width = Math.ceil(width * PNG_SCALE);
				canvas.height = Math.ceil(height * PNG_SCALE);
				const ctx = canvas.getContext('2d');
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				resolve({ png: canvas.toDataURL('image/png').split(',')[1], width: canvas.width, height: canvas.height });
			};
			img.onerror = () => reject(new Error('could not rasterise the diagram'));
			img.src = url;
		});
	}

	async function renderOne(source, index, target) {
		const { svg } = await window.mermaid.render(`book-export-d${index}`, source);
		return target === 'png' ? toPng(svg) : { svg };
	}

	let rendered = 0;

	async function renderJob(job) {
		const usePng = job.target === 'png';
		window.mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'strict',
			theme: 'default',
			htmlLabels: !usePng,
			flowchart: { htmlLabels: !usePng },
		});
		const results = [];
		for (let i = 0; i < job.sources.length; i++) {
			status(`${job.label}: diagram ${i + 1} of ${job.sources.length}`);
			try {
				results.push(await renderOne(job.sources[i], rendered++, job.target));
			} catch (error) {
				results.push({ error: String((error && error.message) || error) });
			}
		}
		return results;
	}

	const MERMAID_WAIT_MS = 30000;

	/**
	 * Joplin injects dialog scripts dynamically, so this small script can run
	 * before the 5 MB mermaid bundle has executed. Wait for its global.
	 */
	async function waitForMermaid() {
		const started = Date.now();
		while (typeof window.mermaid === 'undefined') {
			if (Date.now() - started > MERMAID_WAIT_MS) throw new Error('the mermaid library did not load');
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	/** Long-poll the plugin for jobs until it reports that the export is finished. */
	async function run() {
		status('Loading the diagram renderer…');
		await waitForMermaid();
		for (;;) {
			const job = await webviewApi.postMessage({ type: 'job' });
			if (!job || job.done) {
				status(job && job.summary ? job.summary : 'Done.');
				return;
			}
			if (job.status) {
				status(job.status);
				continue;
			}
			const results = await renderJob(job);
			await webviewApi.postMessage({ type: 'result', results });
		}
	}

	run().catch((error) => status(`Diagram renderer failed: ${(error && error.message) || error}`));
})();
