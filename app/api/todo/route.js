import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const GET = async () => {
  try {
    // Mengambil data dari Vercel KV
    const result = await kv.get("item");
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};