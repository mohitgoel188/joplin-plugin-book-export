import render from 'dom-serializer';
import { parseDocument } from 'htmlparser2';

/**
 * Re-serialise an HTML fragment as well-formed XHTML.
 *
 * EPUB chapters are XML. Rendered markdown can still carry raw HTML from the
 * note (`<table>`, `<br>`, unclosed `<p>`, `&nbsp;`) that an XML parser rejects,
 * so the fragment is parsed leniently and written back in XML mode. Entities are
 * written as UTF-8 characters, because XHTML in EPUB declares no named entities
 * beyond the five XML ones.
 */
export function toXhtml(fragment: string): string {
	const doc = parseDocument(fragment, { lowerCaseTags: true, lowerCaseAttributeNames: true, decodeEntities: true });
	return render(doc, { xmlMode: true, selfClosingTags: true, encodeEntities: 'utf8' });
}
