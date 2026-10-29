import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { documentsService } from '@/modules/documents/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'admission_officer', 'clerk']);
    const contentType = request.headers.get('content-type') || '';

    let studentId = '';
    let admissionApplicationId = '';
    let documentTypeId = '';
    let fileName = '';
    let fileSizeBytes = 0;
    let mimeType = '';

    if (contentType.includes('application/json')) {
      const json = await request.json();
      studentId = json.studentId;
      admissionApplicationId = json.admissionApplicationId;
      documentTypeId = json.documentTypeId;
      fileName = json.fileName;
      fileSizeBytes = json.fileSizeBytes;
      mimeType = json.mimeType;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      studentId = formData.get('studentId') as string;
      admissionApplicationId = formData.get('admissionApplicationId') as string;
      documentTypeId = formData.get('documentTypeId') as string;
      const file = formData.get('file') as File | null;

      if (!file) {
        throw new Error('No file provided in form-data payload.');
      }

      fileName = file.name;
      fileSizeBytes = file.size;
      mimeType = file.type || 'application/pdf';
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const document = await documentsService.uploadDocument(
      {
        studentId,
        admissionApplicationId,
        documentTypeId,
        fileName,
        fileSizeBytes,
        mimeType,
      },
      session
    );

    return NextResponse.json({ document }, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/documents/upload',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
