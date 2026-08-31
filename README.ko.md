# soksak-plugin-process-monitor

이 플러그인은 public `process.inventory` command를 읽는 읽기 전용 sidebar consumer입니다.
workstation을 스캔하거나 terminal plugin의 DOM을 읽거나 실행 파일 이름으로 소유권을 추정하지
않습니다. Mount 시점에는 `process.inventory`에서 revision owner snapshot을 얻고 이후에는 public
`process.inventory.changed` stream을 monotonic revision마다 한 번 적용합니다. Stale event는 무시하고
gap은 polling으로 복구하지 않고 `PROCESS_REVISION_GAP`으로 표시합니다. 명시적 `refresh`는 operator
recovery이며 read-only `status` command는 reduced snapshot, initialization, failure를 공개합니다.
mount된 project마다 `status.projects`는 선택된 process record에 project id와 root를 추가합니다. UI와
status는 같은 projection에서 PID, PPID, cwd, pane, project, lifecycle을 공개합니다.
`wait` command는 같은 event-reduced state를 구독하고 지정 owner가 기준 revision을 초과하면서,
요청한 경우 정확한 process count에 도달하면 완료됩니다. Polling하지 않으며 timer는 대응 event가
오지 않을 때 무한 대기를 막는 실패 기한으로만 사용하고, 이 기한은 internal exception이 아니라
기계 판독 가능한 `TIMEOUT` code를 반환합니다.
Optional `cwd`가 없는 record는 `PROCESS_CWD_UNAVAILABLE` 수치에 포함하고 project에 귀속하지 않습니다.

선택한 environment에 등록된 owner가 공개하고 현재 project root와 같거나 그 하위인 `cwd`의 record만
표시합니다. 터미널이나 sidecar가 실제로 열려야 record가 생기며 browser view는 process record를
만들지 않습니다. 폴링은 사용하지 않습니다.

다른 플러그인과 runtime dependency를 맺지 않습니다. Core sidebar section API가 작업 화면 옆에
배치하고 process contract가 데이터를 제공합니다.

## 검증

실행 중인 host에서 공개 command를 사용합니다. `sections.left`는 section을 고정 sidebar에 배치하고,
`plugin.soksak-plugin-process-monitor.status`는 기계 판독 가능한 inventory를 반환합니다.

```sh
sok sections.left '{"set":"<process-monitor-section-set>"}'
sok workspace.region.toggle '{"region":"left","open":true}'
sok plugin.soksak-plugin-process-monitor.status '{}'
```

선택된 각 process에 `pid`, `parentPid`, `cwd`, `pane`, `project`, `state`가 있고 event revision이
누락 없이 증가할 때만 GREEN입니다. 화면 검증에는 캡처가 필요하며 status 응답과 캡처는 별도 증거로
관리합니다.

## 빌드

```sh
make verify
make publish-local STORE=/absolute/local-release-store OUT=/absolute/release-output
```
