import { createClient } from 'redis';
import { NextResponse } from 'next/server';

// Menghubungkan ke database Redis Vercel
const redis = await createClient().connect();

export const POST = async () => {
  // Mengambil data dari Redis dengan kunci "item"
  const result = await redis.get("item");

  // Mengembalikan respon berupa data JSON
  return new NextResponse(JSON.stringify({ result }), { status: 200 });
};