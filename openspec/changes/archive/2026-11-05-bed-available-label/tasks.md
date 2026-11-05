# Tasks

## 1. Web presentation (apps/web)

- [x] 1.1 Add the bed-availability pair-mapping (0BR + shared-room → the new "Bed available" message key) as a sibling to the Studio mapping in `detail-values.ts`; wire `cardBedroomsValue` and `detailBedroomsValue` through it; add the key to every locale; verify component tests pin all four pair cases on both surfaces (0BR efficiency → Studio, 0BR shared-room → Bed available, 1BR private-room → numeric, nonzero apartment → numeric), the Studio-change shared-room numeric pins are flipped honestly to expect the new vocabulary, mutation calibration catches an all-0BR or wrong-pair widening, and the i18n audit stays green (`pnpm -C apps/web test`)
- [x] 1.2 Update any e2e/BDD steps that assert a shared-room bedroom value; verify `pnpm -C apps/web e2e` + `e2e:bdd` + `e2e:prod` all green (stale-listener hygiene first)

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
