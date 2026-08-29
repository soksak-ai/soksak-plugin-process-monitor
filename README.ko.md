# soksak-plugin-process-monitor

이 플러그인은 public `process.inventory` command를 읽는 읽기 전용 sidebar consumer입니다.
workstation을 스캔하거나 terminal plugin의 DOM을 읽거나 실행 파일 이름으로 소유권을 추정하지
않습니다. 첫 release는 mount 시점과 명시적 `refresh` command로 얻은 revision owner snapshot을
표시합니다. 폴링은 하지 않으며 Core가 live process event 표면을 제공한 뒤에만 추가합니다.

다른 플러그인과 runtime dependency를 맺지 않습니다. Core sidebar section API가 작업 화면 옆에
배치하고 process contract가 데이터를 제공합니다.
