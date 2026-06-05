// biome-ignore-all lint/suspicious/noBitwiseOperators: ZIP fixtures need CRC32 and external mode bits.
import { describe, expect, it } from 'vitest'
import {
  prepareGitHubSkillZip,
  prepareSkillMdUpload,
  prepareSkillZipUpload,
  SkillPackageError,
} from './package'

const VALID_SKILL_MD = Buffer.from(
  `---
name: Grill With Docs
description: Stress-test a plan.
---

Read the docs first.
`,
  'utf8'
)

describe('skill package preparation', () => {
  it('prepares a single SKILL.md upload', () => {
    const prepared = prepareSkillMdUpload({ content: VALID_SKILL_MD })

    expect(prepared.name).toBe('Grill With Docs')
    expect(prepared.fileCount).toBe(1)
    expect(prepared.files[0]).toMatchObject({
      executable: false,
      path: 'SKILL.md',
    })
  })

  it('accepts root zip packages and preserves executable bits', async () => {
    const prepared = await prepareSkillZipUpload({
      content: makeZip([
        { content: VALID_SKILL_MD, mode: 0o10_0644, path: 'SKILL.md' },
        {
          content: Buffer.from('#!/usr/bin/env bash\necho ok\n', 'utf8'),
          mode: 0o10_0755,
          path: 'scripts/run.sh',
        },
      ]),
    })

    expect(prepared.files.map((file) => file.path).sort()).toEqual([
      'SKILL.md',
      'scripts/run.sh',
    ])
    expect(
      prepared.files.find((file) => file.path === 'scripts/run.sh')
    ).toMatchObject({ executable: true })
  })

  it('accepts one enclosing folder', async () => {
    const prepared = await prepareSkillZipUpload({
      content: makeZip([
        { content: VALID_SKILL_MD, mode: 0o10_0644, path: 'skill/SKILL.md' },
      ]),
    })

    expect(prepared.skillMdPath).toBe('SKILL.md')
    expect(prepared.files[0]?.path).toBe('SKILL.md')
  })

  it('rejects multi-skill and missing SKILL.md zips', async () => {
    await expect(
      prepareSkillZipUpload({
        content: makeZip([
          { content: VALID_SKILL_MD, mode: 0o10_0644, path: 'a/SKILL.md' },
          { content: VALID_SKILL_MD, mode: 0o10_0644, path: 'b/SKILL.md' },
        ]),
      })
    ).rejects.toThrow(SkillPackageError)

    await expect(
      prepareSkillZipUpload({
        content: makeZip([
          { content: Buffer.from('nope'), mode: 0o10_0644, path: 'README.md' },
        ]),
      })
    ).rejects.toThrow(SkillPackageError)
  })

  it('rejects traversal, absolute paths, and symlinks', async () => {
    await expect(
      prepareSkillZipUpload({
        content: makeZip([
          { content: VALID_SKILL_MD, mode: 0o10_0644, path: 'SKILL.md' },
          { content: Buffer.from('x'), mode: 0o10_0644, path: '../escape.txt' },
        ]),
      })
    ).rejects.toThrow(SkillPackageError)

    await expect(
      prepareSkillZipUpload({
        content: makeZip([
          { content: VALID_SKILL_MD, mode: 0o10_0644, path: '/SKILL.md' },
        ]),
      })
    ).rejects.toThrow(SkillPackageError)

    await expect(
      prepareSkillZipUpload({
        content: makeZip([
          { content: VALID_SKILL_MD, mode: 0o10_0644, path: 'SKILL.md' },
          { content: Buffer.from('target'), mode: 0o12_0777, path: 'link' },
        ]),
      })
    ).rejects.toThrow(SkillPackageError)
  })

  it('filters GitHub archive zips to the selected source path', async () => {
    const prepared = await prepareGitHubSkillZip({
      content: makeZip([
        {
          content: Buffer.from('ignore'),
          mode: 0o10_0644,
          path: 'repo-main/README.md',
        },
        {
          content: VALID_SKILL_MD,
          mode: 0o10_0644,
          path: 'repo-main/skills/grill/SKILL.md',
        },
      ]),
      sourcePath: 'skills/grill',
    })

    expect(prepared.name).toBe('Grill With Docs')
    expect(prepared.files.map((file) => file.path)).toEqual(['SKILL.md'])
  })

  it('ignores unsupported GitHub archive entries outside the selected source path', async () => {
    const prepared = await prepareGitHubSkillZip({
      content: makeZip([
        {
          content: Buffer.from('AGENTS.md'),
          mode: 0o12_0777,
          path: 'repo-main/CLAUDE.md',
        },
        {
          content: VALID_SKILL_MD,
          mode: 0o10_0644,
          path: 'repo-main/skills/grill/SKILL.md',
        },
      ]),
      sourcePath: 'skills/grill',
    })

    expect(prepared.name).toBe('Grill With Docs')
    expect(prepared.files.map((file) => file.path)).toEqual(['SKILL.md'])
  })

  it('rejects unsupported GitHub archive entries inside the selected source path', async () => {
    await expect(
      prepareGitHubSkillZip({
        content: makeZip([
          {
            content: VALID_SKILL_MD,
            mode: 0o10_0644,
            path: 'repo-main/skills/grill/SKILL.md',
          },
          {
            content: Buffer.from('target'),
            mode: 0o12_0777,
            path: 'repo-main/skills/grill/link',
          },
        ]),
        sourcePath: 'skills/grill',
      })
    ).rejects.toThrow(SkillPackageError)
  })
})

interface ZipFixtureFile {
  content: Buffer
  mode: number
  path: string
}

function makeZip(files: ZipFixtureFile[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8')
    const content = file.content
    const crc = crc32(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04_03_4b_50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(content.byteLength, 18)
    local.writeUInt32LE(content.byteLength, 22)
    local.writeUInt16LE(name.byteLength, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, name, content)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02_01_4b_50, 0)
    central.writeUInt16LE(0x03_14, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(content.byteLength, 20)
    central.writeUInt32LE(content.byteLength, 24)
    central.writeUInt16LE(name.byteLength, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE((file.mode << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, name)

    offset += local.byteLength + name.byteLength + content.byteLength
  }

  const centralOffset = offset
  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06_05_4b_50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectory.byteLength, 12)
  end.writeUInt32LE(centralOffset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

function crc32(buffer: Buffer): number {
  let crc = 0xff_ff_ff_ff
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0
}

const CRC_TABLE = Array.from({ length: 256 }, (_value, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xed_b8_83_20 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})
