const url = process.argv[2];
for (let attempt = 0; attempt < 120; attempt++) {
  try {
    if ((await fetch(url)).ok) process.exit(0);
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
throw new Error(`Timed out waiting for ${url}`);
