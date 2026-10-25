export function validImage(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.length > 15 * 1024 * 1024)
    return false;
  return mimeType === 'image/png'
    ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === 'image/jpeg'
      ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : mimeType === 'image/webp'
        ? buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
        : false;
}
