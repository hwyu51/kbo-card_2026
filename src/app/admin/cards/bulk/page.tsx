export default function AdminBulkPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-bold">벌크 업로드</h1>
      <p className="text-sm text-zinc-500">
        다음 단계에서 구현됩니다 — CSV 양식 업로드 → 미리보기 → 오류 행 확인 → 확정(upsert).
        양식은 <code>templates/보유카드_업로드_양식.csv</code> 참고.
      </p>
    </div>
  );
}
