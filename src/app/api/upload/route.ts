import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// 허용 이미지 형식: MIME → 저장 확장자 (SVG는 스크립트 삽입 위험으로 제외)
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** 파일 앞부분 바이트로 실제 이미지인지 확인 (확장자/MIME 위조 방지) */
function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 12).toString('ascii').startsWith('ftypavi')) return 'image/avif';
  return null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: '파일 크기는 10MB 이하만 가능합니다.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(buffer);
    if (!mime || !ALLOWED[mime]) {
      return NextResponse.json(
        { success: false, error: 'JPG, PNG, GIF, WEBP, AVIF 이미지만 업로드할 수 있습니다.' },
        { status: 415 }
      );
    }

    // 파일명은 서버에서 생성 (사용자 입력 파일명 미사용 → 경로 조작 차단)
    const filename = `upload-${Date.now()}-${randomUUID()}.${ALLOWED[mime]}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ success: true, url: `/uploads/${filename}` });
  } catch (error: unknown) {
    console.error('File upload failed:', error);
    return NextResponse.json({ success: false, error: '파일 업로드에 실패했습니다.' }, { status: 500 });
  }
}
