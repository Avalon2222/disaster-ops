#!/usr/bin/env bash
# Menaruh berkas hasil di cabang `data` lalu mendorongnya. Dipakai GitHub Actions.
# Cabang `data` selalu berisi SATU commit (ditimpa tiap kali), supaya repositori tidak membengkak
# oleh riwayat snapshot yang ditulis empat kali sehari.
#   bash scripts/simpan_cabang_data.sh keluar/cuaca.json [berkas lain...]
set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if [ -d cabang-data ]; then
  git worktree remove --force cabang-data 2>/dev/null || rm -rf cabang-data
  git worktree prune
fi

git worktree add -q --detach cabang-data
cd cabang-data
git checkout -q --orphan data-baru
git rm -rfq . >/dev/null 2>&1 || true

# berkas lama di cabang data yang tidak ikut diperbarui kali ini tetap dipertahankan
if git fetch -q origin data 2>/dev/null; then
  git checkout -q FETCH_HEAD -- . 2>/dev/null || true
fi
echo "Cabang data: snapshot prakiraan (cuaca.json). Ditulis otomatis oleh GitHub Actions tiap 6 jam, riwayatnya tidak disimpan." > README.md
# cabang ini cuma data: Vercel jangan mencoba mem-build-nya
printf '{ "git": { "deploymentEnabled": false } }
' > vercel.json
for berkas in "$@"; do
  cp "../$berkas" "$(basename "$berkas")"
done

git add -A
git commit -q -m "Perbarui $(for b in "$@"; do basename "$b"; done | paste -sd' ')"
for percobaan in 1 2 3; do
  if git push -q --force origin HEAD:data; then
    echo "Cabang data diperbarui."
    exit 0
  fi
  sleep $((percobaan * 5))
done
exit 1
