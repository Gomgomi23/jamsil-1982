// 팬 제보 접수 설정 — Supabase 프로젝트를 만든 뒤 두 값을 채운다 (supabase/README.md 참고)
// 비어 있으면 1단계처럼 이 기기 브라우저에만 저장한다.
// anon 키는 공개용 키라 사이트에 들어가도 된다. service_role 키는 절대 넣지 않는다.
window.JAMSIL_CONFIG = {
  supabaseUrl: "https://qrgnxyjknnzwsvfwnfio.supabase.co",
  supabaseAnonKey: "sb_publishable_2-MCXVQqE3AC23k4OfB8cg_QMZS_Raj",  // publishable(=anon) 키. 공개용
  // 팬 제보 창 열기. 공개 전 체크리스트(supabase/README.md D)가 끝나기 전까지 false
  submissions: false,
};
