import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {gzipSync} from 'node:zlib'

import {packTar} from 'modern-tar'
import {expect, test} from 'vitest'

import {decodeText, parse, toArray} from '../../it-utils/index.js'
import {fromExportArchive} from '../fromExportArchive.js'

test('untar movies dataset export, but not reading assets', async () => {
  const docsFromExport = fromExportArchive(`${import.meta.dirname}/fixtures/example.tar.gz`)

  const allDocs = await toArray(parse<{_id: string}>(decodeText(docsFromExport)))

  expect(allDocs.map((doc) => doc._id)).toEqual([
    'e749feed-4a9e-4175-b130-913f28436f62',
    '12274d53-4d6d-4aa4-9ace-d15da7ba7c10',
  ])
})

test.each(['tar', 'tar.gz'])(
  'read documents around skipped entries in %s archives',
  async (format) => {
    const directory = await mkdtemp(join(tmpdir(), 'migrate-export-'))
    try {
      const docs = [{_id: 'first', text: 'a'.repeat(40_000)}, {_id: 'last'}]
      const first = new TextEncoder().encode(`${JSON.stringify(docs[0])}\n`)
      const last = new TextEncoder().encode(`${JSON.stringify(docs[1])}\n`)
      const archive = await packTar([
        {header: {name: 'export/', size: 0, type: 'directory'}},
        {header: {name: 'export/empty.ndjson', size: 0}},
        {body: first, header: {name: 'export/first.ndjson', size: first.length}},
        {
          body: new Uint8Array(50_000),
          header: {name: 'export/images/asset.jpg', size: 50_000},
        },
        {header: {name: 'export/directory.ndjson', size: 0, type: 'directory'}},
        {body: last, header: {name: 'export/last.ndjson', size: last.length}},
      ])
      const path = join(directory, `export.${format}`)
      await writeFile(path, format === 'tar.gz' ? gzipSync(archive) : archive)

      expect(await toArray(parse(decodeText(fromExportArchive(path))))).toEqual(docs)
    } finally {
      await rm(directory, {force: true, recursive: true})
    }
  },
)

test.each(['empty.tar', 'invalid.tar', 'corrupted.tar'])('reject %s archives', async (file) => {
  await expect(
    toArray(fromExportArchive(join(import.meta.dirname, 'fixtures', file))),
  ).rejects.toThrow()
})
