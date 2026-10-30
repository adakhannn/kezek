# Полный трекер ручного тестирования Kezek

> Исторический журнал, а не текущая очередь. С 30 октября 2026 широкий ручной процесс закрыт; automation PAUSED, продукт NOT_READY. Текущая передача: [WEB_AGENT_HANDOFF.md](WEB_AGENT_HANDOFF.md). Не выполнять старые ACTIVE/NEXT/deadline из записей ниже и не добавлять сюда новые длинные checkpoint. Результаты — в ledger и первичном evidence.

Учёт приёмки с 18 октября: [единый реестр](./WEB_VERIFICATION_LEDGER.json), [метод и разбор прежнего процесса](./WEB_VERIFICATION_METHOD.md), [вычисляемая сводка](./WEB_VERIFICATION_REPORT.md). Ниже сохранена прежняя история. Новые результаты записываются адресно в реестр/evidence, без дублирования длинных stage-логов. Изменение учёта не запускает живые тесты или автоматизацию.

18Oct G155 FINAL extension-1: G155 extension-1 FINAL administrative closure: existing kezek explicitly PAUSED 2026-10-18T02:56:08.081Z, config readback verified/status+updatedAt only changed. Hard deadline03:08:35UTC; actual final mtime/deadline proof saved separately in g155-final-verification.json. NOT_READY/new extension live fixes0/whole areas0; 2newtest files only, G1519new+4controls13PASS and G15210new+2controls12PASS/types0/new lint0/0, not additive coverage/live/API-RLS proof. Product runtime unchanged/current004e2b56/exact2->main18bd8/exact7->run17eb65. Six inherited red UNIT assertions remain pending live; G139 browser control blocked/no recovery or current-role proof. NF refreshed02:41:56.542 before02:43; 5prior finals/old main18progress-verification immutable; old15-16MISSED untouched. No new scenario/test/source/browser/auth/SQL/DB command during finalization; no continuous work claim/no autonomous resume. Evidence global-2026-10-18-extension-1/final-report.json and g155-final-verification.json.

18Oct G154: G154 requiredNONFINALrefresh published actualmtime2026-10-18T02:41:56.542Z BEFORE02:43UTC/hash771cd98b/archiveg154; originalg153archivekept. Audit4stage manifests10extensionraw31inheritedmainraw5priorfinals match/source004e2b56 unchanged/exact2->bd8/exact7->eb65 calibrationretained. FreshactualkezekconfigreadbackACTIVE/samecorrect03:08:35UTCdeadline/name-target-createdAt-prompt/no configwrite; explicitPAUSED notyetdone. No newscenario/test/source/browser/auth/SQL/DBcommands. Newextension0/whole0/NOT_READY/old6redUNITassertionspendinglive/old15-16MISSEDunchanged. G155NEXTfinalizationONLY about02:55: actualclock/usage, explicitPAUSED+final+verify BEFORE03:08:35; noextension. global18extension1/stage-G154-required-nonfinal-refresh.json.

18Oct G153: G153 early NONFINAL extension-1 published actualmtime2026-10-18T02:30:54.635Z BEFORE02:43UTC, archivedg153/SHA4827ead1. Administrativeaudit3G150-152manifests7extensionraw31inheritedmain18raw5priorfinals hashesmatch; prior main18progress/finalverification unchanged. Current004e2b56 exact2extensiontestexcluded=>main18bd8bc839 and exact7combined=>run17runtimeeb65. No new testexecution/runtime/browser/auth/SQL/DBcommands. Newextension0livefix/whole0/NOT_READY; G1519new13PASS/G15210new12PASS narrowunit-only, sixpriorredassertionspendinglive. ExistingkezekACTIVE perG150lastactualreadback; no freshconfig/pauseclaim. DraftNOTfinal/notPAUSED; next02:40refresh then explicitPAUSED from02:50/finalbefore03:08:35/noextension. global18extension1/stage-G153-early-nonfinal-audit.json.

18Oct G152: G152 new supporting F4/SEC03 dashboard-parent UNIT contract for applications page:10new+2existing business-contextcontrols=>2s12PASS/types0/newfilelint0errors0warnings/legacy notices retained. Real pureBizAccessError class, supplied resolver unauth/denial/service/generic/pending cases; redirect-or-error prevents child/private content, allowed syntheticcontext rendersproperbizsidebar. NO realresolver/role/HTTP/RLS/flashproof or G145fix. One NEWtest only/exactexclude=>prior22f1565a/current004e2b56;7runtime/configSHAsunchanged. G1413red+G1453red retained pendinglive/UIcontrolstillblocked/no retry/auth/DBcommands. Git171staged9779insertions399dirty actorunknown/noagentstage-reset. Newextensionlivefix0/whole0/NOT_READY. global18extension1/stage-G152-dashboard-parent-access-contract.json.

18Oct G151: G151 supporting WB202/E2 new parent-route UNIT contract:9new +4existing initial-loading controls =>2s13PASS/types0/newfilelint0errors0warnings, legacy process notices retained. Server initial no-user redirects, cookie-client-auth rejection propagates, pending guards and read-only cookie adapter pass. Valid SSR returns shell with empty props, not loaded identity; client reads independently/root event updater does not inspect profile-read errors. G1413FAIL+G1453FAIL remain pending real UI, NOT new livebug/fix/wholeareaPASS. Only one NEWtest, exactexclude restorespriorbd8bc839/current22f1565a; all inspected runtime/Jest hashes unchanged. UI control blocked/no browser retry/auth/DB commands. Git170staged9679insertions398dirty actorunknown/noagentstage-reset/preserved. global18extension1/stage-G151-profile-server-auth-contract.json.

18Oct G150 extension-1: G150 new explicit one-hour authorization from actual02:08:35UTC to03:08:35UTC/09:08:35Bishkek18Oct. ExistingkezekPAUSED->ACTIVE/same15min/newUNTIL/readbackverified; prior main18 timely finalSHA7696ff3b preserved, new separate extension-1. Fresh inventory sameIAB2oldDenied1+known3Packages/sameprovider metadata only/no recovery signal/no bind-content-retry. New extension livefix0/wholeareas0/NOT_READY; prior6UNITfailures pendinglive/runtimebd8bc839 unchanged. Next bounded new parent profile-route auth-boundary contract, not product fix/live proof. Evidence global-2026-10-18-extension-1/stage-G150-extension-preflight.json.

18Oct G149 FINAL: G149 administrative final closure: explicit existing kezek PAUSED 2026-10-18T01:30:18.069Z; actual config readback verified, other fields preserved. Final NOT_READY, new run live fixes0/whole areas0, inherited5+2+10 not new. Five test files only/runtime unchanged; saved G1413FAIL and G1453FAIL retained pending live reproduction. UI control remains blocked/current role unknown; no browser retry/new test/product/DB/auth commands during closure. NONFINAL published01:11:39.459 before01:20; old15-16 MISSED and17 timely unchanged. No continuous work claim/no autonomous resume. Evidence: global-2026-10-18/final-report.json and g149-final-verification.json.

18Oct G148: G148 requiredNONFINALrefreshbefore18Oct01:20, administrativeonly/no productscenario: 10G138-147stagehashes/27uniquerawfiles/4quietrecords/4old15-17finals match; sourcebd8bc839unchanged/exact5test-onlyruntimecalibrationG147retained. SavedG140scoped95.83PASS/G144GETPASS andG1413FAIL/G1453FAIL preserved/notrerun/liveproof/wholegreen. ExistingkezekactualACTIVE/same18Oct02deadline/readback01:10/no configchange; explicitPAUSEDnotyetdone. CurrentNONFINALthroughG148/priorG147archived/G143-G145kept; newrun0/whole0/NOT_READY/old15-16MISSED unchanged. Next01:24turnshortprefinal/waitboundeduntil01:30thenexplicitPAUSED+honestfinal+verifybefore02, no newscenario or autonomous extension. global18/stage-G148-nonfinal-deadline-checkpoint.json.

18Oct G147: G147 administrativeprefinalaudit dueaddedG144-146evidence, no newproductscenario: 9G138-146manifests/25uniquerawhashes/2quietheartbeatrecords/4old15-17finalhashesALLmatch. Currentbd8bc839 withEXACT5newtestpaths excludedmatchesrun17runtimeeb65; no runtime/config/shared/SQLchangeinrun18. Re-readsavedG1402filecoveragePASSandG1413FAIL/G1453FAIL/rawsuccessfalse preserved, notnewtestexecution/wholegreen/liveproof. NONFINALrefreshedthroughG147/priorG145draftarchived/G143archivekept; newrun0/whole0/NOT_READY. Git169staged9558insertions397dirtyactorunknown/noagentstage-resetpreserved. G139UIcontrolblock/unverifiedcurrentrole persists/no retry; deadline18Oct02UTC/01:20refresh/01:30explicitPAUSED-finalizationunchanged/notfinalnotpaused. global18/stage-G147-prefinal-evidence-audit.json.

18Oct G146: G146 inventoryONLYmonitor: actualCUAgetState IAB2sameoldtab1+userTab3/sameproviderIDs andPackagesURL; no changedstate/recoverysignal. No bind/getTab/navigation/reload/AX/DOM/screenshot/oldmetricsretry; existingTab3markHandoff metadataonly. Currentrole/documentstillunverified/G139block persists; no newproductscenario/test/source/app-DB-authcommands orlivefix. Sourcebd8bc839unchanged; Git169staged9558insertions397dirty actorunknown/noagentstage-resetpreserved. EarlyNONFINALthroughG145 retained/notfinal/notpause; G1413red+G1453redpendinglive; newrun0/whole0/NOT_READY. Quietheartbeatwaitforgenuinerecoveryor01:20draft/01:30explicitPAUSEDclosure before18Oct02UTC/noextension. global18/stage-G146-inventory-only-wait.json.

18Oct G145: G145 UNIT-onlyunclosedRoleApplicationsClientread-state: oneNEW10casetest7PASS3FAIL +6existingcontrols =>4s13PASS3FAILexit1 preserved. Networkreject/HTTPerror/JSONparsefailure eachshowscorrecterroralert BUTalsofalseconfirmedemptytitle; 3safetyassertionsFAIL/notnewconfirmedlivebug/no runtimefix. Pendingreadhidesactions-empty; successfulwith/withoutbranch; fourstatuses/pending-onlycontrols/no-branchdisabled/fallbackidentity/literaltextcontrolsPASS. Types0/newfileexplicitlint0errors0warnings+legacyprocessnotice. ProductclientSHAf7740d65unchanged; excludingonlynewtest=prior13763129/currentbd8bc839. ALLrequests mockedGET/no approval-reject-unblock/grants/sourcefix/realHTTP-DB/browserretry. Newrunfix0/inherited5+2+10/whole0/NOT_READY; G1413redprofilecasesalso retained. global18/stage-G145-role-applications-client-read-state.json.

18Oct G144: G144 newboundedUNITreadonlyrole-applicationsGETcontract (G139UIblocked/unclosedlistcase): oneNEWtestfile9PASS +6existingheader-history-branchcontrols =>4s15PASS/scopedGETcoverage24of26statements4of4functions12of12branchesPASS60/types0/newfileexplicitlint0errors0warnings+legacyprocessnotice. Mockresolverrejectstopssuppliedprivilegedclientconstruction; staff/currentbiz/activebranches/100limit/order/blockscope-dedup-map/error-vs-emptynullcontrols verified onlyinmemory. NO actualauthresolver/HTTP/RLS/foreignroleproof/moderation/rights/DBfixture/sourcefix. ProductGET/authBizSHAunchanged; sourceexcludingonlynewtest=prior2570eb4e/current13763129. G139controlblock unchanged/no browserretry; G1413redUNITsafetycasesretained. Newrunfix0/inherited5+2+10/whole0/NOT_READY. global18/stage-G144-role-applications-read-unit.json.

18Oct G143: G143 administrativeearlyNONFINALdraft/auditonly, notproductscenario: 5G138-142manifests/14uniquehashedrawfilesmatch; all4old15-17finalhashesunchanged/old15-16MISSED preserved/17timely. Draftprepared22:56:10UTC/archivedg143/SHA d29989a8, NOTfinal/notpaused. Currentrun0livefix/whole0/NOT_READY; G139controlblock persists/no retry, G140scoped2file95.83PASS andG1413unitredcaseshonestlyseparate/no newtests thisstage. Source2570eb4e unchanged; excludingonly3newtests equalsinheritedruntimeeb65. Git167staged9307insertions395dirty actorunknown/noagentstage-reset/preserved. ExistingkezekreadbackACTIVE/correct18Oct02deadline/notextended; explicit01:30PAUSED andfinalstilltodo. global18/stage-G143-early-nonfinal-audit.json.

18Oct G142: G142 administrativeonly: existingkezekpromptcheckpointupdated/readbackverifiedACTIVE/same15minUNTIL18Oct02UTC/sametarget-name-createdAt. CapturesG139browsercontrolblock/no unchangedretry, G140scopedunitcoveragePASSnotwholegreen andG1413redUNITsafetycasespendinglive/no runtimefix. No newscenario/productsource/browser/auth/SQL/businesscommands. G141stage/rawhashes+old17finalSHA280a582fverified; source2570eb4e/newrun0/whole0/NOT_READY. DraftstillNONFINALpendingby01:20; explicitPAUSED01:30/finalbefore02 required/notaccomplishedyet. global18/stage-G142-automation-checkpoint.json.

18Oct G141: G141 WB202supportingUNIT-onlymissingfailureboundary: addedoneNEW11caseProfileLoadFailureBoundarytest, no runtimechange. Three safetyassertionsFAIL afterprofile-readerror/authrejection/no-user: editableemptyname renderedoncefinallyclearsloading. EightnewcontrolsPASS (RUENKYauthpending/profilepending/notificationpending/3optionalnotificationfailures); existing11controlsPASS =>3s19PASS3FAIL/exit1 preserved. Typecheck0/newfileexplicitlint0errors0warnings+legacyprocessnotice. No real auth/network/failureinjection ornewconfirmedlivebug; G139currenttabcontrolstillblocked/userrefreshpending. Newrunfix0/inherited5+2+10/whole0/NOT_READY; source2570eb4e tests-only. global18/stage-G141-profile-load-unit-boundary.json.

18Oct G140: G140 WB201supportingUNIT-onlycoveragefollowup/notnewproductbug: freshunchangedbaseline3s22PASS butcoveragebranches41.66<60exit1 retained. Added18tests(twoNEWtestfilesonly) forshiftreadfailure-vs-empty, optionalerrors/defaults, mockedserviceclientfallback, explicit/legacydayoff, servicejoins/itemidentity-sorting/openhours, nullableclosedaggregates andhookempty/zero/guarantee. Final5s40PASS/scopedtwofilecoverage184of184statements40of40functions161of168branches95.83PASS60/types0/explicit2filelint0errors0warnings+legacyprocessnotice. Product2files/Jestconfig-setupSHAunchanged; fullfingerprintexcludingonly2newtests equalsprior eb65, current6eb714b4. NO productioncode/query/auth/SQL/ledgerchanges/liveAPI-RLSproof; G139browsercontrolstillblocked/userrefreshneeded. Newrunfix0/inherited5+2+10/whole0/NOT_READY; historicalG116coverageFAILnotrewritten/fullbaseline-notgreen. global18/stage-G140-finance-read-unit-coverage.json.

18Oct G139: G139 attemptedfirstcurrentcandidateOWNERrole-applicationsREADONLY: visiblelinkclickleftPACKAGEStree; oneordinarygotoobservedURLtimedoutPage.navigate, subsequentnativeAXandoneCUAdocumentedDOMalternativebothfocus-emulationtimeout. Freshinventorymetadataavailablebutactualapplicationspage/status/localesNOTverified; g139-applications-ru.txt isoldPACKAGEStree—notPASS. AddressedownNext14216node/projectstart-serverRespondingtrue/3000listening; no HTTPhealthproof/no restart/newtab/oldtab1-adminmetricsretry. NeedmanualhealthyTab3refreshforlivecontrol; sourceeb65unchanged/newrun0/inherited5+2+10/whole0/NOT_READY. No moderation/roles/entities/DB-auth-businesscommands/code-tests. global18/stage-G139-applications-control-block.json.

18Oct G138 resume: G138 newuser-authorizedrun18 resumesNOW until18Oct08Bishkek/02UTC, NOT19Oct (incorrectinterpretationneverapplied). ExistingkezekPAUSED->ACTIVE/same15minheartbeat/newcorrectUNTIL18Oct02/readbackverified. FreshCUAinventoryIAB2tabs1+3/onlyhealthy3read; actualOWNERbusiness2RU/SoldPackagesoneknownclient1of2until11Nov/Allbranches, noauthswitch-command; olddeniedtab1/adminmetricsuntouched. Sourceeb65unchanged/Git163staged8898insertions392dirtypreserved. Newrunfix0/inherited17five+16two+15ten/whole0/NOT_READY; old17timelyfinalimmutableSHA280a582f andold15-16MISSEDpreserved. Setup/baselineonly/notnewproductfix/fullPASS. Evidence global18/stage-G138-resume-preflight.json. Authorizeddeadline18Oct08Bishkek/02UTC; earlieragent19Octinterpretationcancelled/notapplied.

17Oct G137 / FINAL NOT_READY: G137 administrativeFINALclosureonly: existingkezekexplicitPAUSEDactual2026-10-17T04:30:14.447Z verified2026-10-17T04:30:15Z; final-report.json prepared2026-10-17T04:30:22Z before17Oct05UTC/no18Octextension. Newrun5targetedSAME-LIVEfixesWB199-203/inherited16two+15ten/wholeareas0/NOT_READY; allcriticalSEC/WB177/legacyRPC/multijob/external/device/decisiongapsretained. ProductevidencethroughG134/lastactualUI03:45OWNERpackage1of2AllRU; G135-G137administrativeonly/notcontinuousworkornewliveDBproof. 33priorstagemanifests+367hashedfilesmatch/sourceeb65unchanged; G116coverageFAIL41.66/G1232oldlintFAIL retained. Prior15-16deadlinesMISSED/all3oldfinalhashesunchanged. No newsource-tests-UI-DBcommands/roles/entities/deletion/commit-push-deploy. Final global17/final-report.json; actualmtime/hash global17/g137-final-verification.json. DraftNONFINAL04:11retained.

17Oct G136 / administrative NONFINAL audit: G136 administrativeprefinalNONFINALrefreshbefore04:20/no newproductscenario: 32stageG104-G135manifesthashes+366uniquehashedfilesALLmatch/sourceeb65unchanged/count5WB199-203/whole0/NOT_READY. G116coverageFAIL41.66andG1232oldrequirelintFAILrecheckedfromsavedoutputs—notnewtestexecution. Retaineddata/prefs3normalcontextwrites/auth3transitions/telemetryunenumerated/f821nocancel/G062noreplay accounted. Draftclarifieshistoricalcrossrunreferences/lastUI03:45G134/no freshDBorUIclaims. Allold15-16finalhashesunchanged/MISSEDpreserved; existingkezekactualACTIVEreadback/no configwrite. NONFINALNOTfinalorpaused; next04:25shortclosureonly/explicitPAUSEDfrom04:30before05. global17/stage-G136-evidence-nonfinal-audit.json.

17Oct G135 / administrative NONFINAL audit: G135 administrativeevidenceauditonly/no newproductscenario: 31stageG104-G134manifesthashes+365uniquehashedrawfilesALLmatch; 31expectedstagespresent/count5WB199-203/whole0/sourceeb65unchanged. RawtestJSONchecks confirmtargetedPASSandG116coverage22PASSbutsuccessfalse preserved/notwholegreen; G1232oldrequirelintFAILretained. All3old15-16finalhashesunchanged/deadlinesMISSEDnotretroactivelyfixed. ExistingkezekactualACTIVEsame15min17Oct05UTCRRULE/promptc246verified03:57:28; NONFINALdraftrefreshednotfinal/notpause. No source-tests-UI-DB-commands/entities/authchange. global17/stage-G135-evidence-nonfinal-audit.json.

17Oct G134: G134 boundedreadonlycurrentOWNERbusiness2packageprojection: plansshowexisting47adaactive2visits30days0percent/service1branch andlegacy5cedinactive4visits21daysfixed100. SoldActiveAllbranchesoneknownclient/package1of2/expiry11Nov/purchased12Oct agreeswithG108clientpresentation. Expiredfilterempty; Activebranch2empty/branch1same1of2; restoreActiveAllRU samebalance-date. No planEdit/active-toggle/Create/sell/redeem/cancel/refund/Save/auth-SQLcommands/source-tests. Sourceeb65unchanged/newrun5/inherited2+10/whole0/NOT_READY; no expired-depletedfixture or lifecycle-security-visualPASS. Evidence global17/stage-G134-owner-package-projection.json.

17Oct G133: G133 boundedreadonlycurrentcandidateowner/publicserviceconsistency: ownerAll3namegroups(hiddene21545min150-275+2activegroups); branch1twoactivegroups51560min100-300+99c031min0-300/nohidden; branch2hiddene215+active08160min100-300. Publicsamebusiness3activeperbranchcards60+60+1min/sameprices/nohiddenfixture; normalBackretainsownerbranch2URL; explicitAllrestoredRU/business2. Groupedmanagement2activegroupsvs3publicrowsnotmismatch. No create-edit-delete-active-toggle/booking/contacts-SQL-authcommands/source-tests. Sourceeb65unchanged/newrun5/inherited2+10/whole0/NOT_READY. FreshnativeCUAscreenshotfailed/notvisual-devicePASS. Evidence global17/stage-G133-owner-service-public-consistency.json.

17Oct G132 / administrative NONFINAL checkpoint: G132 administrativecheckpointonly/no newproductscenario: existingkezekpromptupdatedfromstaleG127ownerprofile/count4/source2c1 toactualG131ownerbranch1/count5/sourceeb65/G129WB203-G130WB182-G131WB140functionalAXboundaries/screenshotcaptureunavailable. Originalmainconstraints/same17Oct05UTCdeadline/04:20draft04:30winddown04:40nonew/explicitPAUSEDrequired/RRULE-target-name-kind-ACTIVE-createdAtallpreserved. ActualTOMLreadbackmatchesupdatedprompt03:30:14.068UTC/hashc246fb5a2e4893de5211dbf925b5af60892c8f56b5a6dffbab50c4724c17763a. NONFINALthroughproductG131+adminG132/notfinalnotpause/NOT_READY/whole0; old16SHAunchanged/prior15-16MISSEDnotretroactivelyfixed. No source-tests-UI-DB-businesscommands/entities/authtransition. global17/stage-G132-automation-current-owner-checkpoint.json.

17Oct G131: G131 WB140staticbusiness-contextFOLLOWUP/notnewdistinct: freshactualOWNERbranch1ENstillБизнесprefix; existing2branches.editkeysabsentfromRUENKY. Addedonly6dictionaryvalues/no component-query-auth-POSTchange. SameactualbranchENBusiness/KYБизнес/RUБизнес/authoredbizname-phone-inherit-Mon09-18unchanged; missingnamefallbackcomponentONLY. Genuinebefore6FAIL3PASS ->3s12PASS/types0/scoped4filelint0/0. CUAviewport screenshotfailedUnabletocapture; no visual-device-screenreaderPASS. Newrunstill5/inherited2+10/whole0/NOT_READY. Evidence global17/stage-G131-branch-business-context-after.json.

17Oct G130 / WB182 branch weekday follow-up: G130 WB182weekdayFOLLOWUP/notnewdistinct: actualownerbranch1readonlycontactsinheritphone+996500574029/threeempty/checkedinheritRUENKY; Mon09-18othersclosed. KYbranchscheduleall7headingsRussianbefore; minimalBranchScheduleEditorexistingformatBookingWeekday replacesIntlkyICUonly/noschedule-state-save-DBchange. SameactualUIAXafter7KYweekdayscorrect/ENMonday-Sunday/RUrestored/09-18andcontactsunchanged. Genuinebefore1FAIL2PASS->4s35PASS/types0/scoped2filelint0/0. BlankoddscaleJPEGcaptureNOTvisualproof/devicePASS; functionalnativeAXonly. Newrunstill5/inherited2+10/whole0/NOT_READY. Evidence global17/stage-G130-branch-weekdays-after.json.

17Oct G129 / WB203: G129 WB203 NEWtargetedbusinesscontactsettingslocale: actualOWNERbusiness2/settings wholeform+pageheaderRussianinsettledENKY. MinimalexistingclientuseLanguage/servergetT+18businesskeysperRUENKY, unchangedACL-query-POST-payload-errorprecedence/authornames. SAME-LIVEKYlocalizedallstaticlabels ->ENsettledserverheader+form/reload ->RUrestored; phone+996500574029/threeemptyfieldsretained/NOinputorSave. Genuinebefore8FAIL5PASS(afteronefixtureharnesscorrection) ->4s24PASS/types0/scoped7filelint0/0; firstextended4legacycontextFAILretained/fixedtestsetupnotweakenedassertions. Newrun5WB199-203/inherited2+10/whole0/NOT_READY. Evidence global17/stage-G129-business-contact-settings-locale-after.json.

17Oct G128 / administrative NONFINAL checkpoint: G128 administrativecheckpointonly/no newproductscenario: existingkezekpromptreplacedstaleG119-G120checkpointwithactualG127OWNERprofile/source2c1/count4/roles-commands-limits-pendingG126andG129route; commonmainconstraintsunchanged. ActualTOMLprompt/name/kind/target/RRULE/ACTIVEcreatedAtverified, updated03:02:47.063UTC/hasha960fe3606cb949a7d6f8dad8af17640fba391b696a2494c1f55d027f93bdfe5. Same17Oct05UTCdeadline/04:20draft04:30winddown04:40nonew/explicitPAUSEDrequired, no18Octextension/newautomation/chat. NONFINALdraftthroughproductG127+adminG128/refreshednotfinalnotpause/NOT_READY/whole0; old16SHAunchanged/prior15-16MISSEDnotretroactivelyfixed. No source-tests-UI-DB-businesscommands/entities/authtransition. global17/stage-G128-automation-current-owner-checkpoint.json.

17Oct G127 / WB202 owner regression: G127 WB202supportingrolechangedregression/notnewfix: sameactualownerG124 ->PersonalCabinetownUpcoming0(notpureclient5/staffworkspace5) ->profile. Firstprofilelinkcapturestilloldbookings/pendingnavigation NOTloaderproof; settledownnameAccountowner/knownGoogleosorovadahan04freshvisible/4existingconnectedGoogle-Yandex-Telegram-WhatsApp/unchangednotifications/contactphoneblank/SaveResetdisabled. NormalRUreload firstnativeAXЗагрузка/noforminputs/providerlinkcontrols ->settledsameownprofile; deletionblocked2ownedbusinesses+2roles/confirmation-requestdisabled. No input/edit/Save-Reset/link-unlink/OTP/notifications/delete/authswitch/SQL/businesscommands/entities. Source2c1unchanged/newrun4/inherited2+10/whole0/NOT_READY; successfulownownerloadingonly/notfullE2-auth-errorsecurity-devicePASS. global17/stage-G127-owner-profile-loading-regression.json.

17Oct G126 / scope observation: G126 boundedownownerindividualstatsRU->ENsettledretains13Oct650/600/50/topup240/expanded2hrow. NormalENreload resetsvisibleDay17Oct/0/no row; dateandtotalsagree(notwrong13Octzero). ThisseparateuseStaffFinanceStatsData defaultsday+today/localstate; no explicitfullreloadpersistentfiltercontractfoundbeyondK3testreload/generalUX02language-draft. RecordDEC-OWNER-STATS-RELOAD-CONTEXTpending—notnewbug/fix/WB199closure orretentionPASS; no feature silentlyadded. KYsettled17zero/UItranslated; RUrestoredandnativepickerexplicit13=>650/600/50/240/516, rowcollapsed/menusclosed/handoff. Source2c1unchanged/newrun4/inherited2+10/whole0/NOT_READY/no code-tests-SQL-auth-financialbookingcommands/entities. global17/stage-G126-owner-stats-reload-contract.json.

17Oct G125 / WB201 owner regression: G125 WB201supportingread-onlyownerregression/notnewfix: actualownerbusiness2/ownstaff1bfd individualStatistics current17zero ->native13Oct =>650turnover/600staff/50business/topup240/base360/materials50/1closed/1client/late516. Expandexistingclosedrow shows2.00hours/guarantee600/base360 andsingleLIVE TEST FINANCE13OCT itemservice600/materials50, nohourseditor. CurrentrateemptyG124card+existing2auditratechanges13Oct300->empty read only. Year2026=>1000/781/219/materials99/3closed/2clients/late516; rows650+0+350 and600+0+181 /50+0+169 reconcile; restoreDay13samepositivefigures/RUexpandedreadonly/handoff. Source2c1unchanged/newrun4/inherited2+10/whole0/NOT_READY; no code-tests-SQL-auth-financialbookingcommands/entities. Exact909shiftID/rate300historicalcorrelationnotfreshDBSELECT; ownerincludesmaterials vsstaffserviceonlysemanticsunchanged/no fullformulaaudit-security-devicePASS. global17/stage-G125-owner-closed-snapshot-regression.json.

17Oct G124 / legacy owner consumer: G124 changeddependencyregression ofG117sharedFinancePage legacyownerconsumer: actualstafflogout ->normalGoogle4chooserknownownerosorovadahan04 selected02:41:17withoutpassword-CAPTCHA-device-newrights ->selectbusiness current2Continue ->realownerbusinessc28c8109. Ownstaff1bfdFinancePageinitialClients17Octempty/Adddisabled, notpriorstaffStatsDay13; CurrentShift17offRU->ENsettled, normalENreloadSSRClients thenhydratedCurrentShift17off, KYsettledsame. ExplicitClientsKY/reloadretainsClients17empty/Adddisabled; RUrestored/originalClients/handoff. No newbug/fix/code-tests-SQL/financial-booking-shiftcommands/entities. ONE normalcurrent-business preferencePOSTsame2->2 plusauthtransition accounted; notzeroTOTALDBwrites. Source2c1f8335unchanged/newrun4/inherited2+10/whole0/NOT_READY; no foreignrole/API-RLS/fullK3/security/flashfree/devicePASS. global17/stage-G124-owner-legacy-finance-regression.json.

17Oct G123 / WB202: G123 WB202 NEWtargetedfirstpaintfix: actualstaffpersonalprofile reloadRU showsblankName/Allchangessaved/activeGoogle-YandexConnectbeforeloadedactualsameidentity3connectedproviders; corroboratesG122KYinitial. MinimalProfileFormloadinginitialtrue reusesexistinglocalizedloader; no auth-fetch-command-SQL-providerlogicchange. SAME-LIVE ordinaryreloadRU/EN/KYfirstnativeAXshowslocalizedLoading/noinput-linkcontrols ->settledsameАдахан/Googleobraz/3connected/notificationstates/blockeddeletion1role1card/SaveResetdisabled; finalRU. Genuinebefore3FAIL1PASS ->3s13PASS/types0; scopedlintFAILsame2preexistingrequireerrors/no newerrors/suppression. Newrun4WB199-202/inherited2+10/whole0/NOT_READY/source2c1f8335. No profileSave/link-unlink/OTP/notification/delete/authswitch/businesscommands/SQL/entities. global17/stage-G123-profile-initial-loading-after.json.

17Oct G122 / profile baseline: G122 actualstaffobrazpersonalprofile read-onlyRUENKY/reload: loadednameАдаханОсоров/knownGoogleobrazvisible, existingGoogle-Yandex-Telegramconnected/WhatsAppdisabledunconnected; selectednotificationstatesunchanged, no Save/Reset/link/unlink/OTP/delete/settingscommand. Staffaccountdeletionblockedby1role+1staffcard withdisabledconfirmation/request inRUENKY. ReloadKYsettledrestoresactualvalues/connectedstates/guards; RUrestored/profilehandoff. Initialreloadtransientblankname/unconnectedactiveConnectbuttons recordedpendingfirstpaintassessment, notnewbug/fixyet. Source933418f5unchanged/newrun3/whole0/no code-tests-SQL-businessentities/authswitch. global17/stage-G122-staff-profile-readonly.json.

17Oct G121 / read-only role context: G121 realstaffobraz/card1bfd normalPersonalCabinetentry -> /cabinet/bookings Upcoming0/History1existingcancelled5c10f40612Oct09-10. Workingstaff5Upcoming/22Past notdisplayedasownpersonalbookings. Openexistingowncancelledreceipt createsnormaltargetblanktab4/fullsameID-status-master-time; originaltab3retainsHistory1withoutBack; onlyagent-openedtemporarytab4closed. VisibleStafflink ->samecard1bfd/branch1/service1/5Upcoming22Past ->FinancereturnsettledRUStatsDay13/600-600-50/late516/globalclosed3 retained. Newrole-contextread-onlypositivecontrol/notindependentforeignrole/API/RLS/fullsecurity/BOOK04closure. Source933418f5unchanged/newrunfix3/inherited2+10/whole0/no code-tests-SQL-businesscommands/entities/authswitch. global17/stage-G121-staff-personal-workspace-boundary.json.

17Oct G120 / WB140 follow-up: G120 WB140monthpickerlocaleFOLLOWUP/notnewdistinct: actualownstaffMonthNovember2026 RU dropdownEnglishNovember+Englishdategrid; EN/KYcontrolsRussianМесяц/Год. MinimalMonthPickerPopover locale=enUSorru sameexistingDatePickerKY->RUfallback +4existingdatePickerlabelkeys; no dictionaries/calendarbehavior/query/financialcommandchange. SAME-LIVE RUноябрь/RUdates; ENMonth-Year; KYАй-ЖылwithdocumentedRussiandatefallback; clicking2NovKYretainsNovzero andcloses; RUday13/600-600-50/516restored. Genuinebefore5FAIL1PASS aftercorrectingoneharnessmatcher(earlier6FAILretained) ->3s21PASS/types/scopedexplicit2filelint0/0. Englishselectedsuffix/fullKYcalendar/oddscalelayout remainOPEN—notfullO3/a11y/device/FINPASS. Newrunstill3/inherited2+10/whole0/source933418f5. global17/stage-G120-month-picker-locale-after.json.

17Oct G118 / bounded regression: G118 ownstaff readonlychangeddependencyregression afterG117: MonthNovember2026/0 retainedRU->ENsettled; Year2025/0 retainedEN->KYsettled andnormalreloadhydrated(afterSSRCurrent17); yearrestored2026/901services781staff219business/late516. ReturningMonth retainedNovember/0 independently, Dayretained13Oct/600-600-50/516; RUrestored/menusclosed. Globalclosed3remainsglobal. No newbug/fix/code-tests-SQL-financial-authcommands. Source9156e177/newrunfix3/whole0. MonthpickerRUinternalEnglishlabels pendinglocalizationassessment/notnewfix. global17/stage-G118-finance-period-context.json.

17Oct G117 / WB199 follow-up: G117 WB199 financecontextfollowup/notnewdistinct: repeatactualstaffStatisticsDay13Oct600/600/50 ->ENimmediatecorrect then settledCurrent17off. Existingtabpersistenceoverwritesrestoreddefault/filterslocalonly. FinalboundeduseSyncExternalStore/sessionUIview onlytab-period-date-month-year; serverauthorizedbiz:staff viewScope passedwithoutstaffIdimpersonation/querychange; operationdate/items/editstateNOTstored. SAME-LIVEEN13 ->KYsettled13/50 ->RUsettled13/50 ->reloadinitialCurrent17thenhydratedStatsDay13/50; notflashfree. Truebefore4FAIL2PASS; firsteffect21PASSbutlint1ERRORretained/superseded; final3s24PASS/types/scoped4filelint0/0/hookcoverage69of71statements54of62branches19of20functionsPASS60. G116servicecoverageFAILstillretained. Source9156e177/newrunfix3/inherited2+10/whole0/no financial-SQL-authcommands. global17/stage-G117-finance-view-context-after.json.

17Oct G116 / WB201: G116 WB201 newtargetedfinancialstatsfix: actualstaffobraz/StatisticsDay13Oct showedbusiness-190 vsretainedfinal50, staff600/services600/late516. SourceclosedRPCsavesfinalsalon_share; hookandSSRstatssubtractedtopup240again. Minimalremove2duplicate deductions/noledger-command-auth-SQLchange. SAME-LIVEday13RU50/EN50/KYexplicitreselected13shows50; alltimeRU+KY219instead-21,services901/staff781/closed3/late516unchanged. LocaleNextrefreshresetsstats->current17off observed/pendingNOTfixed; no retentionclaim. Truebefore6FAIL2PASS->3suites22PASS/types0/lint0errors1preexistingwarning. Separatecoverage22PASSbutexit1branches41.66<60 retained/NOTwholegreen. Sourcee450164f/newrunfix3WB199-201/inherited2+10/whole0/no booking-shift-pay-SQL-businessentitycommands. global17/stage-G116-closed-stats-topup-after.json.

17Oct G115: G115 actualstaffobraz/card1bfd read-onlyschedule current17–30Oct displays19+26Mon09–18branch1/other12off/AsiaBishkek. Next14 ->31Oct–13Nov displays2+9NovMon09–18/other12off. ENKYretain14dates/intervals/branch-authoredname; Previous14KYreturns17–30/RUrestored. Loadingstatesseparatedfromsettledproof. No daycard/edit/hours/publish/save/shift/booking/auth/SQLcommands; source6c1b707a unchanged/newrunfix2/inherited2+10/whole0. Boundedexistingstaffpublishedplanread notunconfiguredstaff/publication/transfer/absence/allconsumers/API-RLS/multijob/device/fullareaPASS. global17/stage-G115-staff-schedule-read.json.

17Oct G114 / WB199 follow-up: G114 WB199 staff-history follow-up/notnewdistinct: actualstaffPast22->known034receipt->nativeBack resetUpcoming5. FinalminimaluseStaffBookingListHistory usesNextuseSearchParams/router.replace scopedread-only staffList/past+biz/staff URL; creationformlocal/notrestored; serverqueries/auth/permissions unchanged. FinalSAME-LIVE scopedPast22 EN->KYrefresh ->same034receipt ->BackPast22sameorderedIDs; RUrefresh+ordinaryreloadretain22; explicitUpcomingrestores5/cleanURL. Earlierrawhistory andnativeURL prototypes failedlive refresh/Back despiteunitgreens, ALLretained/notaccepted. Originalbefore4FAIL4PASS; final3suites36PASS/types0/lint0errors1existingunusedstaffwarning+legacyprocessnotice. Newrunfix2/inherited2+10/whole0/source6c1b707a; no booking/SQL/businessentity/authcommands. URLUI3paramsnew; serverqueriesunchanged. Allfailedprototypes/evidencekept; no newdistinctcount. global17/stage-G114-staff-history-context-after.json.

17Oct G113: G113 currentactualstaffobraz/ownstaffcard1bfd UpcomingfirstDetails14c108 ->settledread-onlyreceipt fullsameID/confirmed/master/19Oct09:00 RUENKY(KY2026-ж.,19-октябрь09:00). No bookingmutationcontrolpresent/clicked. RUrestored/nativeBack ->staffbookingsUpcoming5sameorderedIDs-status-times/Past22button/currentstaff/menusclosed. Rolechangeddependencyvspriorowner/clientreceipt; notforeignobject/API/RLS/fullsecurity/wholeBOOK04/J1/locale/devicePASS. UpcomingdefaultBackonly—notPastselectionretention. Source0ddcd0efunchanged/newrunfix2/inherited2+10/whole0/no code-tests-SQL/businesscommands/entities/authswitch. global17/stage-G113-staff-receipt-entry.json.

17Oct G112: G112 actualstaffobraz/card1bfd read-onlybookings: Upcoming5matchesfiveknown19OctIDs/times/statusconfirmed; ENKYRUretain5 andlocalizedstaticstatus/time/client/branch/businesslabels. Pasttab22rendereduniquereceiptlinks; KY->EN->RUretainexactordered22IDs, known034/eaa/1308present. ReturnUpcomingRUrestores5sameIDs/time. No Details/Create/status/cancel/attend/pay/shift/schedule action; no source-test-SQL/newentities/authswitch. Boundedownstafflist/locale/tabnavigation only, notglobalDB/foreignstaff/API/RLS/fullJ1/wholeBOOK04/wholelocalePASS. Newrunfix2/inherited2+10/whole0/source0ddcd0ef unchanged. IDs22rowsnot22tests/no newbug-fix. global17/stage-G112-staff-booking-lists.json.

17Oct G111: G111 actualclientSignOut ->guestroot; normalGooglechooser4 ->knownobraz00:09:08 withoutpassword-CAPTCHA-device-newrights ->actualstaff /staff/card1bfd0e3b/branch1business2/service31one60min100–300/Upcoming5Past22. Normalreloadretainsstaff; rolemenuStaff+Mybookings/noowner/Escapeclosed. Oneordinaryknown/dashboardPAGE ->settledroleStaff/Нетдоступа; visibleStafflinkreturnsown/staff. No API/RLS/foreignstaff/multijob/fullauthmatrix/wholeareaPASS. Source0ddcd0efunchanged/newrunfix2/inherited2+10/whole0/no code-tests-SQL/businesscommands/entities; standardauthtransition/telemetryaccounted. Currentactualstaffobraz/RU/staff/card1bfd/tab3handoff; clientno longercurrent. Fourchooseroptionsnot4sessions; no credentials export. global17/stage-G111-google-staff-session.json.

17Oct G110 / WB200: G110 WB200 targetedSAME-LIVE: actualauthenticatedpureclientStep5 RU/EN/KY incorrectlyrequests signin/guest; confirmedsettledcurrentClient+own5banner beforepatch. MinimalBookingFormSections description now branches on existingisAuthed/reusesexistinglocalizedsummary.selectSlotFirst; guestdescription/auth/commands/dictionariesunchanged. SameStep5RUENKYnowconfirmationguidance/day19/master/service/12unselectedslots/count5/disabledSelectTime retained; RUrestored/Backsameclient5/pkg1of2. Genuinebefore6FAIL0PASS ->3suites36PASS/typesexit0/scopedlint0errors2preexistingunusedwarnings+legacyprocessnotice. Newrun17distinct2WB199+200/inherited2+10/whole0/source0ddcd0ef. No slot/hold/create/cancel/pay/authswitch/SQL/businessentities. Guest/identitytransitioncomponentcontrolsnotfreshguestlive. 2preexistingunusedwarningsretained. global17/stage-G110-step5-auth-guidance-after.json.

17Oct G109: G109 actualpureclient Repeat14c108 preview: prefilledbranch1/master/service31, no oldday-time; current17OctSaturday no specialists/Nextdisabled. Explicit19Oct ->same master/service60min100–300 ->Step5ownactivebookingwarning5 and12unselectedslots14:15–17. ENKYRU retainday/choices/count5/disabledSelectTime; no slot clicked/hold/create. One nativeBack ->cabinetUpcoming5sameIDs-times-status/pkg1of2expiry11Nov. Boundedrepeat-previewonly/notfinalrepeat/fullBOOK04/security/devicePASS. No product-test-SQL/businesscommands/entities/authswitch; source9f9b8c4d unchanged/newrunfix1/inherited2+10/whole0. StaticauthenticatedStep5sign-in/guestinstructionpendingassessment/notnewbugcount. No hold/create/cancel/pay; telemetryunenumerated/notzeroDBwrites. global17/stage-G109-client-repeat-preview.json.

17Oct G108: G108 actual owner logout ->guestroot ->one nativeBack /auth/sign-in?redirect=/dashboard/no ownerworkspace. Real Google chooser listed4knownaccounts; selectedlow.fade23:24:10 withoutpassword-CAPTCHA-device-newrights; callbackpreservednextdashboard ->actualclient/LIVE TEST CLIENT12OCT/Нетдоступа. OwnМоизаписи ->cabinet/bookings5knownconfirmed19Oct+pkg1of2до11Nov; normalreloadretainsclient/5/pkg. PAGEdenial+ownpositivecontrol only, notHTTP/API/RLS/allrole/callbackreplay/securitymatrix. No sourcefix/newbug/tests/businesscommands/SQL/entities; authsignout-login accounted. Newrun1/inherited2+10/whole0/source9f9b8c4d unchanged. CurrentRU pureclientlow.fade/Upcoming5/pkg1of2/tab3handoff;4Googlechooseroptionsnot4sessions. Standardlogout-login/authtelemetrynotzeroDBwrites; no credentials export. global17/stage-G108-google-client-session.json.

17Oct G107: G107 WB199 supporting same-owner active-business regression only: originalbiz2/19Oct/branch1/five -> existingownedbiz1 ID35e5b36c/default17Oct/no branchcontrol/NoStaff/no five links ->restorebiz2IDc28c8109/default17All -> explicitly native-reset19All/five for handoff. No crossbusiness oldfilters displayed at settled stage. Does NOT prove hookguardmechanism (history state not inspected), perbusiness rememberedfilters, independentforeignowner/API/RLS security or wholearea. No newbug/fix/code/tests; source9f9b8c4d unchanged/newrun1/inherited2+10/whole0. Two normal activebusiness preference commands restored2; ordinarytelemetryunenumerated/notzeroDBwrites. global17/stage-G107-owned-business-calendar-context.json.

17Oct G106 / WB199: G106 WB199 targeted SAME-LIVE verified:19Octbranch1->existing14c108receipt->Back formerly17All; minimal history-entry filter store now19branch1/fiveknownIDs. Forward/Back, settledreload, ENKYRU and branch2NoStaff->Allfive controls. Newrun17distinct1/inherited16two+15ten/whole0. No auth/session-copy/DBcommand/entity. Source9f9b8c4d. Genuinebefore3FAIL3PASS, final3s29PASS/types/scopedlint0errors0warnings+legacyprocessnotice; firstpost harness12FAIL15PASS preserved separately/notproduct count. Initial SSR17All then hydration19branch1 acknowledged/notflashfree. Firstpost harness failures retained. Evidence global17/stage-G106-calendar-context-after.json; finalRU19OctAll/five/tab3handoff. No businesscommands/SQL/entities/authchange; index153/8276actorunknownpreserved.

17Oct G105: G105 healthyhumannewtab3/ownerbusiness2/read-only14c108receiptRUENKYsameID-confirmed19Oct09/BackroutePASS-date17resetpendingcontract/notnewbug/newfix0/inherited2+10/whole0/addf6unchanged/no businesscommands-SQL. Oldblockedtab1untouched; actualCSSnotmeasured. Evidence global17/stage-G105-ui-recovery-receipt.json; RU calendar17Oct/Allbranches handedoff, healthytab3 markHandoff.

17Oct G104 newcorrectedhumanwindow startsNOW04:34Bishkek/until11(05UTC);18Octfuturewindowcancelled/existingkezekACTIVE15min17deadlineverified. Sourceaddf6dd7unchanged/newrunfix0/inherited16two+15ten/whole0;index151-8134/372dirtypreserved. ExistingKezektabsiteunreachable/getTabpolicyDENY(protocol-authority):no retry/alternateURL-tab-HTTP-CDPworkaround; usermanualrefreshneeded/actualrole-bodyunobserved. Addressedmissingdevserverrestoredpnpmdevsession10418/PID14216/3000LISTEN/Ready40.3s—notHTTP-UI-authPASS. No product-testchange/businesscommands-SQL/entities. Oldfinal16SHA64f7eb23/lateclosurehonestpreserved. global17/stage-G104-resume-preflight.json.

16Oct G103 FINAL LATE ADMINISTRATIVE CLOSE: lastproduct/UI/checkworkG10202:35:31UTC ->nextactualclock05:12:15UTC;05UTCdeadlineNOTmet/no continuousworkclaim. ExistingkezekPAUSED05:13:37.408verified/name-prompt-thread-schedulepreserved. G102stage/progress/docpublicationlate05:12explicitlyaccounted; afterexpiredclockonlyadminpause/readonlyaudit/finalreport-state-docs—no newproduct-test-DBscenario. Finalglobal16/final-report.json: newdistinctfix2WB197WB198/inherited15fix10/whole0/NOT_READY/sourceaddf6dd7. Latest39scopedPASS/types/lint0/0notwholegreen; security/rolefixtures/device/domain/searchscopeblockersremain. Allolddata/slots/late516retained/no cleanup/f821notcancelled/telemetryunenumerated. Furtherworkrequiresnewdirecthumanpermission.

16Oct G102 WB198tooltipfollowup—notnewdistinct:actualENKYcalendarfiveRussianОткрыть бронь #ID ->localizedBookingPillcallerexistingopenBookingkey/title??preservesauthoredsummary/sharedCardunchanged. SAME-LIVEKYБрондоонуачуу/ENOpenbooking/RUoriginalonall5samehrefs-times/day19-All/HMRretained. Before2FAIL13PASS->3s39PASS/types/scopedlint0/0+oldprocessnotice. G101tooltippendingresolvedtargeted/notwholeaccessibility-locale; authoredsummaryunitonly/notfreshlive. No booking/status/receipt/export/pay/SQL/entities;RUrestored/bothhandoff. Sourceaddf6dd7/newrunfix2/inherited15fix10/whole0;index151/8134/dirty372preserved. FreshoddscaleENJPEGcontextnothover-device-screenreaderPASS. global16/stage-G102-calendar-tooltip-after.json.

16Oct G101 WB198 owner-calendar accessible labels: actualENKYФильтр по филиалу/Дата календаря ->2existingkeysx3dicts(6values)/no component-querychange. SAME-LIVEKYФилиал боюнча чыпка-Календардын датасы/ENBranch filter-Calendar date/RUunchanged;19Octbranch1fiveIDs-timesmatchhistory/branch2NoStaff;datebranchfivepersistlocale. HMRreset16All explicitlyrecoverednativecalendar—notHMRdraftPASS. Truebefore6FAIL3PASS->3s32PASS/types/scopedlint0/0+legacyprocessnotice. RussianBookingPillfallbacktooltippending/notfixed. No businesscommands/SQL/export/newentities;finalRUCalendar19OctAll/5links/bothhandoff. Newrunfix2/inherited15fix10/whole0/source0d27ae99;index151/8134/dirty371preserved. FreshoddscaleENJPEGnotphone-tablet-screenreaderPASS. global16/stage-G101-owner-calendar-labels-after.json.

16Oct G100 routine owner history filters (H1/G2, not client E1/E3): settled8rows ->confirmed5known19Oct ->branch2empty ->shortIDf821/branch1onecorrect13:15–14:15; EN/KY/RU preservecombinedfilters/historytab. Clearsearch5/Allfiltersrestore8. Only8loaded/page30—notglobalhistorysearch/paginationPASS ornewWB135fix; no row/cancel/status/create/payment/SQL/code/tests. Newrunfix1/inherited15fix10/whole0/sourcee5f30d57 unchanged; index151/8134/370 preserved. FinalRUownerbusiness2/historyAllactive-Allbranches-emptysearch/bothhandoff. DOM/nativeAXonly—notvisual/device/screenreaderPASS. global16/stage-G100-owner-history-filters.json.

16Oct G099 WB140financecopyfollowup—notnewdistinct:actualEN/KYВсе филиалы +ENБизнесprefix ->6valuesof2existingdictionarykeys only/no components-querychanges. SAME-LIVE ENBusiness/Allbranches KYБардыкфилиалдар/RUrestored/authorednamesretained;Year2026all1000-781-219/branch2zero->Allsame1000. Before2FAIL1PASS->3s14PASS/types/lint0/0+oldprocessnotice. G098staticcopyobservationresolvedtargeted/notwholelocale-finance. No businesscommands-SQL/newentities. Sourcee5f30d57/newrunfix1/inherited15fix10/whole0; index151files8134insertions370dirtyactorunknown/preserved; currentRUfinanceYear2026Allhandoff. FreshENoddscaleJPEGnotdevicePASS. global16/stage-G099-finance-static-labels-after.json.

16Oct G098 WB187status-countfollowup:notnewdistinct. Actualbusiness/staffRU3закрыта ->6neutralopen-closedcounttemplatesRUENKY. SAME-LIVEbusinessMonthRUЗакрытые:3/YearRUENKYclosed3/staffRUОткрытые:0•Закрытые:3; crosssurface1000=901services99materials/781employee219business/3closed unchanged. Before9formatcontractFAIL18PASS->5s47PASS/types/scopedlint0/0+oldprocessnotice; openpositivefixturesnotliveproven. No financialcommands-SQL-datachange. SeparateENKYstaticRUВсе филиалы/БизнесprefixrecordedpendingG099—notfixed. CurrentRUstaffYear2026/3closedcollapsed;source1e089fde/newrunfix1/inherited15fix10/whole0; freshoddscaleJPEGnotdevicePASS. global16/stage-G098-finance-status-counts-after.json.

16Oct G097 routineRUownstafffinance:October-month/2026-year1000turnover781employee219business/base541/topup240/materials99/late516/3closed2clients; visiblecards650+0+350=1000/600+0+181=781/50+0+169=219. Ordinaryyearspinbutton2025->settledzero/noledger->2026restoressameaggregate. ActualRU3смены/0клиентов supportsG096 butnotnewbug/tests. No code-tests-SQL-businesscommands/editor/reopen; currentRUYear2026/allcards collapsed/handoff. Source0998e1d2unchanged/newrunfix1/inherited15fix10/whole0; DOMonly/notvisual-device/fullfinance/API/DBPASS. global16/stage-G097-finance-period-controls.json; healthyquiet.

16Oct G096 WB187financecountfollowup—notnewdistinct: RU1Клиенты/1Смен EN1Clients/1Shifts KY1Кардарлар/1Сменалар ->existingcounthelper+18financeforms ->SAME-LIVE RU1клиент/1смена EN1client/1shift KY1кардар/1смена. Date13/expandedclosedcard/hours2/base360/guarantee600/topup240/650-600-50 retainedthroughlocalechanges; RUrestored/no financialcommands-SQL. Genuinebefore18FAIL9PASS ->5s48PASS/types/scopedlint0/0(legacyprocessnotice). Newrunfix1/inherited15fix10/whole0/source0998e1d2. Index150files8100insertions369dirty observedactorunknown/preserved. global16/stage-G096-finance-counts-after.json; notfullfinance-locale-devicePASS.

16Oct G095 K1/K3/K5 targetedRUownerstaff13Octclosedcontrol:2.00hours/base360/guarantee600/topup240/650=600service+50materials/600employee50business/1clientLIVE TEST FINANCE13OCT/late516. Existingrateaudit13Oct17:34 dash->300/17:43 300->dash. Exactshift909/item2e5 IDs/rate300 historicalcorrelationonly/notfreshDOM-ID/DBsnapshotproof. No edit-hours/reopen/payment/SQL/code/tests. RU13Octcardexpandedhandoff; sourceec1cf20funchanged/newrunfix1/inherited15fix10/whole0. FreshJPEG4257x3667oddscale/notdevicePASS. Evidenceglobal16/stage-G095-closed-shift-snapshot.json; fullFINgatesnotclosed.

16Oct G094 K1/K3 targetedRUowner: ordinaryknownosorovadahan04Googlelogin->ownbusiness2; nativecalendar13Oct aggregate650=services600+materials50/employee600(92.3%)/business50(7.7%)/1closed; branch1same/branch2zero-empty/Allrestored. Two datefillattempts reverted16, nativecalendarworks—no productbug/rootcauseclaim; misnamed13Octfilecontains16diagnostic retained. No shift-rate-hours-item-payment/SQL/code/tests. CurrentownerRU/financeDay13Allhandofffordetailnext; sourceec1cf20f unchanged/newrunfix1/inherited15fix10/whole0. Notfreshshift-detail/DB/security/fullfinance/devicePASS. FreshJPEG4257x2333oddscale; global16/stage-G094-owner-finance-filters.json.

16Oct G093 B2/A4 routinecurrentcandidateunknownslug -> localizedNotFoundRUENKY/retry+cataloglinks; ENretryretainsexpectedstate/KYcataloguerecovery2knownbusinesses/session+locale preserved. RUandinitialbookingStep2branch1day16/emptydependentchoices restored. No newbug/code/tests/SQL/commands; sourceec1cf20f unchanged/newrunfix1/inherited15fix10/whole0. DOMonly/notHTTPstatus/deleted-inactive-malformed/fullsecurity/visual/wholeareaPASS. Quiethealthyresult; global16/stage-G093-missing-business-recovery.json.

16Oct G092 B2/D1: actualpublicbusiness2 RUENKY shows2branches/3active-servicecards/1staff/0offers; conditions60min100–300som twice+1min0–300som. Servicecardsinformational/noper-serviceCTA; notnewfeature/bug. ActualKYChooseBranch->samebusinessStep1/KY-knownclientretained/2unselectedbranches/Nextdisabled. RU/branch1/day16Step2 restored/no dependentchoices. No code/tests/SQL/contactactivation/booking/hold; sourceec1cf20f unchanged/newrunfix1/inherited15fix10/whole0. Notinactive/externalcontacts/allroles/wholeB2/devicePASS. FreshKYJPEG4257x2333oddscale; global16/stage-G092-public-business-entry.json.

16Oct G091 WB197 partialdeepStep5recovery RU: restored15OctURL/staff/service -> settledNoSlots/ChooseTimedisabled; BUT15Octalsooffday, therefore NOTindependentpastdateguard/server/securityPASS. VisibleDay->warning/Nextdisabled; explicit19Oct retainsmaster/service andreturns12unselectedslots14:15–17. No code/tests/SQL/time/hold/booking; restoredRU16OctStep2/emptydependentchoices. Sourceec1cf20f unchanged/newrunfix1/inherited15fix10/whole0. FreshrecoveryJPEG4257x2333 oddscale/notdevicePASS; stageglobal16-G091-deep-date-recovery.

16Oct G090 D2 RU: actualmasteronly1service → multiservice/duration-sum UNVERIFIEDfixturegap/no assignmentscreated. Single-service selection60min100–300som surviveswizardBackStaff/NextService; deselectclears+blocksNext, reselect->12unselectedslots14:15–17/ChooseTimedisabled. No time/hold/booking/SQL/code/tests. RestoredRU16OctStep2/branch1/no staff-service-slot. Sourceec1cf20f unchanged/newrunfix1/inherited15fix10/whole0; notnativehistory/security/fullD2/devicePASS. Evidenceglobal16/stage-G090-service-selection-navigation.json.

16Oct G089 WB197 upperbound followup RU:15Dec inclusive enabled/Nextenabled;16Dec calendar-disabled + settleddeeplinkwarning/Nextdisabled; explicit15Dec recovers. RestoredRU16OctStep2/branchfe1/no staff-services-slot. No code/tests/SQL/booking/hold; sourceec1cf20f unchanged/newrunfix1/inherited15fix10/whole0. Not maxdaystaff-slot-bookability/API/security/alllocales-upperbound/device/fullD1-D2PASS. FreshJPEG4257x3000 oddscaleCSS1277x1651DPR.45. Evidenceglobal16/stage-G089-upper-date-range.json.

16Oct G088 WB197 D1/D2/O3: atrealUTC15Oct23/Bishkek16Oct05 default16/past15disabled correct, butpastdayURL kept15selected+Nextenabled→actualStep3technicalerror. Existingbusinessday bounds nowguardsteps2-4; no silentclamp, localizedcalendarwarning. SAME-LIVE15Nextdisabled RUENKY+reload; explicit16→Nextenabled→NoStaff→finalRU16Step2. Truebefore7FAIL4PASS→5s54PASS/types; scopedlint1oldError2oldWarningsFAIL. Newrun16distinct1WB197/inherited15fix10/whole0/sourceec1cf20f. No slot/hold/booking/DBcommands; notpastbooking/API/deepstep5/fulltimezone/wholeareaPASS. FreshJPEG4257x3000oddscale CSS1277x1651DPR.45/notdevicePASS; index149/8051 observedactorunknown/preserved. Evidenceglobal16/stage-G088-day-range-after.json.

16Oct G087 B4/O4 targeted live keyboard PASS: RU nativeTab/Enter/Space/ShiftTab, EN Space, KY Tab/Enter select correct branch; exclusive aria-pressed/focus retained/correct branch href; locale change preserves selection.17DOM observations(3seeds/10nativekeys/3locale/1reload), NOT17tests/screenreader/fullkeyboard/device/geolocation/wholeareaPASS. RUreload→allcategories/2branches/no selectedcard/bothhandoff. No code/tests/newbug/booking/geo/SQL/business commands; run16new0/inherited15fix10/whole0/source73eeb604 unchanged. FreshKYfocusJPEG4257x2333 oddscaleCSS1277x1651DPR.45; stageglobal16-G087-map-keyboard.

16Oct G086 B4/O3: EN/KY map category remains Женская парикмахерская. Classified as existing name_ru-only reference-content contract gap, not missing UI dictionary/new distinct bug; WB094 already documented this boundary. Added pending DEC-CATEGORY-LOCALES before pilot; no invented translation/schema/admin/API feature. Actual selected category keeps canonical slug + 2 branches; RU/all restored, both handoff. No code/tests/SQL/business commands; source73eeb604 unchanged/new16fix0/inherited15fix10/whole0. Fresh selectedEN JPEG4257x1333 oddscale CSS1277x1651DPR.45, not device/screenreader/full localization PASS. Evidence global16/stage-G086-category-contract.json.

16Oct G085 B4/O3 WB187followup: actualRUmap2местдлязаписи → existingcounthelper/3dictionaryforms → SAME-LIVE2места/EN2places/KYunchanged; category2/reset/selectedbranch2bookinghref retained безпереходакзаписи/геолокации/DBcommands. Truebefore4FAIL14PASS→3s35PASS/types/scoped0errors1oldwarning. FreshJPEG4257x2333oddscale CSS1277x1651DPR.45/неphone-tablet-responsivePASS. Не новый баг: global16new0/inherited15fix10/whole0/source73eeb604. RUmap/allcategories/noselectedcard/bothhandoff. OptionЖенскаяпарикмахерская ENKY остаётсяRU—неclassifiedбаг, контрактtaxonomyтребуетпроверки. Evidenceglobal16/stage-G085-map-count-after.json.

16Oct G084 E2/Q3/O3/O4: actualpureclient profile inlineDeleteAccount blockedby5futurebookings RUENKY/emptydisabledconfirmation+disabledrequest/SaveResetdisabled/Google-prefsoriginal. NativeTabfromlastemailcheckbox skipsdisabledcontrols→footer; no checkboxactivation. Ниphrase/POST-DELETE/profileSave/provider-link/notification/SQL/datachange, ниsourcefix/newbug/global16fix0/whole0. FreshJPEG4257x3333 oddscale actualCSS1277x1651DPR.45; неrealphone-tablet-responsive-screenreader/security/deletionlifecyclePASS. RUProfile/bothhandoff/source13cae4d1/index147-7948unchanged. Stageglobal16-G084-deletion-guard; inherited15fix10 не пересчитывается.

16Oct G083: новое прямое окно до11Бишкек/05UTC, winddown04:40; existingkezekACTIVE/samechat/15min подтверждено. Global16newfixes0/whole0; прежние10fixesglobal15 не пересчитаны. Old15G082 PAUSED21:42:14UTC/final21:42:51UTC поздно относительно13UTC, gapпослеG08112:22невыдаетсязанепрерывнуюработу. Final-report-1900.json и утреннийfinal сохранены. Actualtab1RUknownpureclientHistory3/034200/review3★pkg1of2/nodialog/listener3000PID7512; Supabase2sessionexpired/sign-ininventoryonly/no query-login. Ни новых тестов-продуктовыхфиксов-businesscommands, ни SQL/grants/roles/indexcommands; source13cae4d1. Evidence global-2026-10-16/stage-G083-resume-preflight.json; следующийG084доступныйнезакрытыйWEBкейс.

15Oct G081: подготовлен NONFINAL final-report-1900.draft.json; не финальныйитог/неPAUSED. Аудит51ссылки result-fix-followup-DDL/0missing,62stageJSONparse,69directhashes; это локальнаясогласованность, неproduct/securityPASS/новыеавтотесты. Global10/day7/whole0/source13cae4d1 неизменны; утреннийfinalSHA2a967848 сохранён/старыйсрок05UTCнебылсоблюдён. Existingkezekcheckpointобновлёнчерезофициальныйtool/samecadence-thread-13UTCdeadline/ACTIVE; PAUSEDпроверитьприwinddown12:40до13UTC. ActualRUclientHistory3/034200review3★pkg1of2/обаtabhandoff/безUIcommands-SQL/sourcefix/indexchange. Stage-G081-day-report-checkpoint.json.

15Oct G080 E1/O4: actualpureclient cabinet nativeLeft/Right/wrap/Home/End/Tab→activepanel/ShiftTab→activeTab RUENKY targetedPASS; ARIAcontrols-labelledby reciprocal/oneTabstop/5upcoming+3history retained.17наблюдений(1seed16nativekeys), не17автотестов/неscreenreader/неwholekeyboard-areaPASS. Безsourcefix/newbug/commands/SQL/global10day7whole0/source13cae4d1. RUHistory/034200сом/review3★+text/pkg1of2/bothhandoff/index147-7948unchanged. Screenshotfailed/noPNG/неphone-tablet-visualPASS. Stage-G080-cabinet-tabs-keyboard.json.

15Oct G079 E1/E3/O3 / WB189 followup: actualKYpaid034 русский Итоговая сумма → одинключKYсловаря → SAME-LIVE Жыйынтык сумма:200сом; EN200KGS/RU200сом/history3/review3★+originaltext/pkg1of2/RUrestored. До4FAIL8PASS реально →3s22PASS/types/lint0/0/source13cae4d1. Не финансовыйфикс/не новыйбаг/global10/day7/whole0/безcommands-SQL-cancel. Дваснимкаfailed/noPNG/actualCSS1277x1648DPR.375/неvisual-phone-tabletPASS/G078PNGисторический. Stage-G079-final-amount-after.json/обаtabhandoff/index147-7948actorunknownpreserved. G078pendingниже теперьfollowupverified; историческиезаписисохранены.

15Oct G078 / WB196: Enterheadermenu→nativeTab soleownmenuitem→Escape закрывал, нофокусBODY. Triggerref/возвраттолькоизсвоегоконтейнера: SAME-LIVE RUENKY возвращаетtrigger; outsideclickEnglish оставляетфокусEnglish/неперетягивает, RUrestored. Роли/источники/авторизация/навигациянеменялись. До3FAIL6PASS реально →3s18PASS/types/lint0/0/source9e5e49e8. Global10/day7/whole0. СвежийPNG получен4087x5503 oddscaleприactualCSS1277x1651/DPR.45 — неphone/tablet/visual-responsive/screenreaderPASS. История3/review3★/package1of2 retained/tab1+SQL2handoff/index146/7902actorunknownpreserved. Stage-G078. ВKYзамеченрусскийFinalAmountlabel, отдельныйfollowupещёнетронут/несчитаетсяновымфиксом.

15Oct G077 / WB190 followup: Repeat прежнейpaid034 открылStep4/current15Octoffday с выбраннойуслугой/Визитсобран, ноNextblocked и общейневернойпричиной. Step3показалNoStaff. Узкаяdisplaycondition наужеавторитетномempty staffFiltered/безloading-error повторноиспользуетNoStafftitle/body: SAME-LIVE RUENKY причинадня/Nextdisabled;19Octрабочийконтроль сохраняетмастера-услугу/readyNextenabled. Ниgate/filter/selectionreset/SQL, ниTime/slot/hold/bookingнеизменены/незапускались. До3FAIL9PASS реально →3s38PASS/types/lint0/0/sourceb494e42c. Не новыйбаг/global9/day6/whole0. Исходные5confirmed/history3/034review3★-text/package1of2 сохранены, RUHistory/tab1+SQL2handoff; screenshotfailed/noPNG/неwholebooking-security-responsivePASS. Stage-G077, index145/7846actorunknownpreserved.

15Oct G076 / WB195: после предыдущего reload SignIn→краткий sign-in→root сноваSignIn повторилось2раза, при клиентском менюClient. СерверныйлогAuthRetryableFetchError/status0 — контекст, не доказанная причина сети/expiry. Узкий router.refresh после existing-session router.replace: SAME-LIVE тотжеSignIn возвращает согласованный headerLIVE TEST CLIENT12OCT/кабинет/выход без новогоOAuth. Собственныйкабинет/контрольreload показывают5прежнихconfirmed/времена/package1of2до11Nov; History3/034paid200som/original3★+текст сохранены. G075postreloadgap закрыт текущимUI, неSQL. До2FAIL1PASS реально до кода →3s19PASS/types/lint0/0; source d882d349/global9/day6/whole0. Безкомандданных/cancel/provider/grants/tokenreading; screenshotfailed/noPNG/неfullSEC04-security-responsivePASS. Stage-G076; RUHistory/tab1+SQL2handoff/index144-7790actorunknown/preserved.

15Oct G075 / WB194: actual14c108 preview EN Cancel/Cancel и KY Жокко чыгаруу/Жокко чыгаруу означали противоположные действия. Два специальных labelключа RUENKY + два prop существующего BookingCard: SAME-LIVE различимые Keep booking/Cancel booking и локализованные пары; Enter только безопасного действия закрывает/возвращает фокус, EN nativeTab/Return. Настоящий before6FAIL3PASS →3s24PASS/types/scopedlint0/0, sourcef0088fa9. Все5прежнихброней видны до reload; после reload кабинет запросил вход, причина не доказана/статусы после reload не сверены. Никакой финальной отмены/DBбизнескоманды/f821interaction. Global8/day5/whole0. Снимкиfailed/noPNG/неvisual-responsive-security-fullPASS. Stage-G075/DOM, обаtab handoff/index142-7694 preserved.

15Oct G074 / WB192 followup: существующий отзыв03469725/eb51acab имел raw overlay, Tab уходил на фоновый Repeat, Escape не закрывал, оценка без accessible label. Reuse existing Dialog + связь видимых labels: SAME-LIVE RU/EN/KY named modal/settled focus/native Tab-ShiftTab/Escape-triggerreturn/CancelEnter; локальный черновик отменён, исходные3★/текст восстановлены, RU restored. Update/Create/Repeat не запускались. Настоящий before6FAIL3PASS →6s24PASS/types/lint0/0. Не новый отдельный баг: global7/day4/whole0; source156750ed. Снимок failed/noPNG, не visual-responsive/screenreader/wholeL3-O4/securityPASS. Stage-G074/DOM/focus; index142/7694 observed actorunknown/no agent staging/preserved; tab1+SQL2 handoff.

15Oct G073: история клиента3прежниезаписи(cancelled/paid/noShow);03469725 пакет/200сом/3★, остатокпакета1из2до11Nov. Open создал временнуюtab3, документ RUENKY с темжеID/мастером/12Oct17:00/Выполнена; финансовыхдеталейвнёмнет/не полный reconciliationPASS. RU restored/tab3closed/исходнаяtab1history+SQL2preserved. Только чтение/никаких Repeat/reviewEdit/cancel/payment/status/package/DBкоманд; фиксовнет/global7/day4/whole0/sourceb6af unchanged. Screenshotfailed/не responsive/fullE1E3-securityPASS. Stage-G073/DOM; автоматизацияkezekprompt актуализированабезсменысрока13UTC/расписания, историческийутреннийfinalсохранён.

15Oct G072: Google отвязка — только preview без подтверждения. SAME UI: именованный modal, фокус Close, native Tab/ShiftTab внутри, Escape возвращает фокус; EN/KY предупреждение/CancelEnter/RU restored. Портал вне формы, профиль чистый/Googleподключён/предпочтения прежние. 2s7PASS поддерживают mockконтракты, НЕ live lastmethod/API/RPC/busy proof. Сам unlink/link/Save/OTP/notification/deletion не выполнялись. Новых багов/фиксов нет, global7/day4/whole0/sourceb6afba3f unchanged; снимок недоступен, не полный SEC04/O4/responsivePASS. Stage-G072/DOM, SQL2 untouched/index141-7624 preserved.

15Oct G071 / WB193: смена языка профиля стирала несохранённые имя/телефон и показывала чистую форму. Узкий per-instance initial-load guard: SAME-LIVE RU→EN→KY→RU сохраняет черновик и локализованную ошибку, Save заблокирован/Reset доступен. Явный Reset и reload вернули исходный профиль/RU/прежние флажки. До3FAIL3PASS реально до кода; после4s15PASS/types; lint те же2старыхrequireerrors/0warnings FAIL. Ошибки собственного harness сохранены отдельно/не productprefail. Нет Save/OTP/link/unlink/уведомлений/удаления/DBкоманд. Global7/day4/whole0/sourceb6afba3f; stage-G071/DOM, снимок недоступен, не полный E2/O2/security-responsive PASS. SQL2 untouched, index141/7624 observed/preserved/actorunknown.

15Oct G070 / WB192: карта прежней записи14c108 открывалась без modal semantics, Tab уходил на фоновую Отменить, Escape не закрывал. Узко подключён существующий Dialog: SAME-LIVE подтверждены имя/описание, settled фокус внутри, native Tab/Shift+Tab, Escape и возврат к исходной На карте; EN/KY закрытие/RU восстановлен. До6FAIL3PASS реально до правки; после3s24PASS/types/scoped lint0/0. Global6/day3/whole0/sourceca1b1876. Статусы пяти подтверждённых записей сохранены; отмена/hold/DB команды не выполнялись. Снимок недоступен, не PASS отрисовки карты/адаптивности/screenreader/всего O4. Stage-G070 и DOM/focus сохранены, SQL2 untouched; index140/7527 observed/preserved, actorunknown/no agent staging command.

15OctG068–069: Любоймастер19OctService31→12невыбранныхстартов14:15–17;20Octмастеровнет/Nextdisabled. НовыйWB191: сводкаошибочноНе выбранпривыбранномany→узкийstaffIdprop/существующийперевод/completeindicator. SAME-LIVE RUENKY/конкретноеимя/обратноAny/12слотов/60min100–300/блокировкавыходногосохранены. До3FAIL6PASSреальнодоправки;после3s36PASS/types/scoped2files0errors3старыхwarning. Global5WB187–191/day2WB190–191/followupsнеприбавлены/whole0/sourcef7a65c7c. Нетвыборавремени/hold/броней/DBкоманд/сущностей/прав/удалений/indexmutation;RUclient19Step5anyService31/SQL2SELECTdraftuntouched. DOM+stageG068/G069/снимокнеполучен/неvisualresponsive-fullbooking-securityPASS.

15OctG067 WB187homefollowup SAME-LIVE: RU1вариант1место/2варианта2места,EN1option1place/0plurals,KY0-1-2сохранены;queryсохранилсяприlocale/reset→пустой/RU/2бизнеса. Existingcounthelper/2подписи/3словаря,поискнеизменен. До4FAIL14PASSреальнодокода,после3s35PASS/types/scoped4fileslint0/0;unit0-1-2-5-11-21невыданызавсеlivefixtures. DOM/stageG067/снимокнеполучен/неvisualresponsive-full-languagePASS. Не5-йбаг/global4/day1/whole0/source723756bb;DBкоманд/сущностейнет/телеметриявозможна;index137-7367сохранён/SQL2untouched. СледомAnyMasterpublicavailabilitytargetedregressionбезвыборавремени/hold.

15OctG066: прежнийчистыйклиентlow.fade обычныйGoogle→Клиент/LIVE TEST CLIENT12OCT; /staff/schedule,/staff/finance отказнетactiveemployee, /dashboard отказmanagement. Разрешённыйкабинет5прежнихconfirmed19Oct/pkg1of2до11Nov — positivecontrol;ничегонеотменял/повторял/менял. Это3PAGEотказа,неHTTP/API/RPC/RLS/чтениепривилегированнымклиентом/полнаяматрица/flashproof. Source6cf39f39неизменён/новыхфиксовнет/global4/day1/whole0;DOM/stageG066/скриншотнеполучен. ТекущийRUclient/cabinet/bookings;SQL2неизменён. Наrootживые2вариантов/2мест→WB187homefollowupOPEN/nextG067/не5-йбаг/неизменениепоиска. Index137/7367противстарого132/7170замечен/сохранёнбезgitstageкоманд.

15OctG064–065: tablet768x1024фактически3072x4096/DPR.25;Ctrl0безэффекта/overrideснят/settleddefault1277x1648DPR.375восстановлен. НеCSSбаг/неresponsivePASS. Узкийkeyboard-smoke: EnterвозвратДень/переходStaff-Service,Space19Oct иService31снять-добавить→Nextdisabled-enabled/итог0→60min100–300;вернул20OctStep3/RU/исходныйdraft/мастеровнет-Nextdisabled. Locator.pressсначаластавитфокус:неполныйTab/focusrestore/dialog/screenreaderPASS. Новыхбагов/фиксов/DBкоманднет/global4/day1/whole0/source6cf39f39неизменён. DOM/metrics/stageG064/G065сохранены/SQL2неизменен;новыхброней/hold/времени/ролей/удаленийнет,телеметриявозможна.

15OctG063: follow-up WB189 пустой список в выходной теперь имеет локализованный заголовок EN/KY/RU. SAME-LIVE тот же anonymous branch1/20Oct/Step3: мастеров нет/Далее disabled, branch/day/staff/service сохранены, RU восстановлен. Только3ключа словарей; настоящие до2FAIL16PASS, после18PASS/typesPASS/scoped3dictionarylint0/0. Точные DOM до/после и stage-G063 сохранены, screenshot не получен/неvisual-responsivePASS. Не новый5-й баг: global4/дневной1/wholeareas0; DBкоманд/сущностей нет, телеметрия возможна. Source6cf39f39; исторический G062OPEN ниже уже адресован, полная область языка/безопасность не закрыта.

15OctG062 WB190 точечноSAME-LIVE исправлен в текущемявномрежиме:20Octвыходной→мастеровнет/Далееdisabled,со старымstaff-serviceвыбором иreloadтоже;19Octмастер+Service31+12стартов14:15–17возвращаются,времяневыбирал. Измененатолькоexisting3fieldSQLпроекциядомашнихрабочихдней+публичныйоднодневныйconsumer/complete-legacy/loading-error/stale-date/Nextguards;тежеACL/owner/signature/config/range,новыхgrants/privilegedprivate-reads/ролейнет. ПервыйhashguardостановилDDL:innerTextсхлопнулотступы;rawtextContentсовпалссервернымMD5,повторсточнойпроверкой07:57:40успешен/до-послесохранены. До6FAIL2PASSреальнодокода;после5s31PASS/types/3file60coveragegate97.14/83.92/100/100PASS;scoped1стараяimmutabilityошибка3предупрежденияFAIL,неfullgreen. Дневной1новыйWB190/global4WB187–190,WB182followupнеприбавлен. ENKYemptytitleвживуюосталсяRU→WB189followupOPEN/не5-йбаг. ТекущийRUguest20Step3staff-serviceсохранены/Далееdisabled;SQL2safeSELECTdraft/безDDLвредакторе. СкриншотKezekнеполучен/точныеDOMесть/неresponsivePASS. Нетновыхброней/hold/смен/настроек/ролей/удалений;однаdevfunctionDDLучтенаstage-G062,телеметриявозможна. Wholeareas/legacy/переводы/отсутствия/API/RPC/безопасностьне закрыты.

15OctG061WB190: обычная SupabaseUI2/существующаясессия/одинSELECT определенияwork-location/ACL: фактические3поля/service-only исключаютдомашниерабочиедни. PublicDerivedвключаетвсехдомашнихstaff,обахукапереводовотбрасываютдомашниестроки. Этоmetadata/sourceнефикс/неcallerPASS. Approvedbusiness/даты/62дня/configflagtrueпроверены; RPC/DDL/DML/grants/новыйprivilegedreadнеприменял. Nextузкийexistingprojection+consumercontract/legacy-error-loadingграницы/регрессии/SAME-LIVE. Owner2tab1/SQL2ownSELECTdraftсохранены;stage-G061/definitionSHA/DOM/PNG. WB177held/дневныхфиксов0/zeroareas.

15OctG060: обычный Google-вход владельца osorovadahan04 восстановлен; два прежних бизнеса/текущий2→Продолжить→dashboardc28c. После смены роли прежний /staff/schedule отказал без графика1bfd; /admin/monitoring тоже отказал (известныйосновнойaliasosorov@sportsoft.ru). Все4разрешённыхGoogle-сессии живо наблюдалисьG058–060, не полныйauth/API/RPC/link/replay/expiry/historyPASS. ТекущийRUownerbusiness2tab1; новыхправ/связок/бизнес-сущностей/статусныхкоманднет,обычныеauth/contextcookie/телеметриявозможны. Дневныхфиксов0/zeroarea;WB177SQLheld/WB190OPEN. Proofstage-G060/DOM/dashboardPNG со странныммасштабом неresponsivePASS. Следомузкаяавторитетнаяpubliceffective-dayпроекция,безprivilegedread/grants/маскировкикопией.

15OctG059: обычный Google-вход известного сотрудника obraz восстановлен, staff1bfd/филиал1бизнеса2/однауслуга. Вживую прочитаны пять прежних confirmed19Oct и детали14c108; график19/26Mon09–18,20Octвыходной; финансы15Octпоказывают выходной и недоступность открытия смены. /admin/monitoring отказсуперадмина, /dashboard отказуправления до/послеreload. Профиль показывает уже связанные Googleobraz и основнойYandexalias; ничего не связывал/неотвязывал/несохранял. Это PAGE/read/display PASS, несерверный отказкоманд/API/RPC/чужие роли/отзывдоступа/multiemployment. ТекущийRUtab1/staff/schedule; ownerвходещёнеперепроверен. Дневныхфиксов0,исторические3неувеличены;WB177/WB190открыты. Proofstage-G059/DOM/скриншотстранногомасштаба неresponsivePASS;новыхбизнес-сущностей/команд/правнет,обычныеauth/телеметриявозможны.

15 октября, дневное окно G057–058: пользователь продлил работу до19:00Бишкек (13UTC), стоп новых сценариев18:40. Утренний final-report.json сохранён отдельно с честной поздней финализацией06:57UTC; не переписывать, новый итог final-report-1900.json. Реальный UI восстановлен: browser2/tab1, обычный Google-вход суперадмина→/admin, мониторинг снова показывает известный WB177. После обычного выхода гость перенаправлен на вход; отдельный клиент low.fade вошёл и получил отказ на /admin и том же /admin/monitoring. Это точечная проверка страниц/двух ролей, НЕ защита прямых API/RPC: WB177 SQL не исправлен, caller-risk и старый запрет API не обойдены. Текущий tab1 — клиент, RU, отказ мониторинга. Дневных исправлений0; прежние3WB187–189 иWB182followup отдельно. Снимки/DOM сохранены в stage-G058; фактическая ширина1277/1226 и странный масштаб screenshot не phone/tablet PASS. Новых бизнес-сущностей/статусных команд/прав нет; обычные auth/телеметрические события возможны.

15OctG053 syntheticloggingcontract5PASS/0skips/exit0: actualcopiedwebAuthCallbackcomponent in isolatedJSDOM with mockedSupabasetransport/router/redirectdecision/status; realweb→sharedlogger captureddevhash5calls/PKCEerror4calls. Syntheticraw/18charmarkers absent, positive log/authargument controls proveexercised; helperURLmaskkeepssafenext/dropshash, sanitizerkeepattempt/nestedmask, explicitproductionfactorysuppressesdebugwarn/fixederrornoextra. NotrealBrowser/history/OAuth/session/link/replay/expiry/prod-bundle/alllogproof ornewlivebug/sourcefix. Redirectfixturepausedbefore200msnavigationtimer/no realclock/session/userrole changes. CanonicalsharedlogSafe alreadyredactsstrings; legacyweblogSafe notusedbythiscallback/no consumersfoundinscopedsourcequery, notremoved/"fixed"speculatively.6primarycopysourcesmatch/current906c396c unchanged/dev7512:3000preserved/no nativeedit/DBcommands/entities/credentials/grants/deploy. Outside485/corecoverage/countsnotadded/oldFAILretained. FreshCUAtabs[]/manualrootpending/notreasked/bypassed. Proofglobal15stageG053/tests/observations/source-equivalence. NextG054evidence/artifact/retained-dataauditincludingtelemetryuncertainty; deadlineunchanged.

15OctG052 distinctcold/canaryboundarydiagnostic: new1618filecopyoutsideapps/web/no.env/.next/cache, G046workspace/logs preserved. Primarysource906c396c/config518a6abdunchanged; onlycopiedSentrysideeffectsdisabled. ChildOS-onlyenv/2publiccontrol+4privatesyntheticNOT_A_CREDENTIALmarkers/no realkeys/newrights/.invalidURLs/strictNodeTCPfetchdeny(exactPostCSSIPC)/14harnesschecksPASS. FulldefaultNext16.0.11Turbo coldnextbuildexit0/24.1seccompile/types/7workers/36staticprerenders, no start/HTTP/DB. Actual153artifactfiles143static+10prerenderhtml/rsc/txt/body/rawURIbase64scanPASS:2publiccontrols specificallyinclientJS891ebd099a55bd69,4privatevalues0matches; manifest72e9af87…. Gatecannotpassonserver-onlypositivecontrol. Notactualproductioncredential/deployed/dynamicpayload/tokenlog/fullsecret/SEC04/P4/REL02/GO audit, not newlivefix or erasureofG050/51negativeFAIL/lint53/3metadataFAIL. Source/no DB/entities/grants/native changes; browserstilltabs[]/manualrootpending/notreasked/dev7512present. Proofglobal15stageG052/copymanifests/canarybuild+scan. Newcopyretainedignoredroot/no deletion. NextG053canonicalweb/sharedlogger+webcallbacksource/syntheticredactionreview; deadlineunchanged.

15OctG051 extendsG050 with realcopiedmiddlewarefunction→handler composition/mockSSRusernull/errornull: middlewareauthlookup1/Nextforward1/noLocation then4handlers200/privilegedmockcalls1/1/8/1;4expected401FAIL. Samecompositionprotectedfunnel401/no serviceclient1controlPASS. This is notactualNextmatcher/router/layout/serverHTTP or deployedleak; session-refreshmiddleware is not intended endpointadmin authorization replacement. Initialoutsideappharnesscouldnotresolve@supabase/ssr/0cases; preserved, dedicatedmodulePaths existingappnode_modules resolveswithoutinstall/sourcechanges/skip/statusweakening. Resolved1s5cases4FAIL1PASS separatefromconfigured485/G05015/2061/251,notaddedcoverage.9sourcecopiesstillmatchG050hashes/current906c396c/dev7512:3000retained;no app/DB/API/HTTP/entities/grants/native/productfix. FreshCUAtabs[]/manualrootpending/notrepeated/bypassed. SEC01 remainsblockedlive/RISK-ADMIN-API sourceevidenceonly/WB177SQLheld. Proofglobal15stageG051/resolved-tests/observations/initiallogs. NextG052readonlySEC04client-env/buildartifactreview; syntheticcanaryonlyifjustified/newcopy/no actualsecretuse/preserveG046. Deadline05/newstop04:40UTC.

15OctG050 SEC01 isolatedsource-execution evidence(notHTTP/liveleak):4exactcopiedadminexports metrics/stats/auth-flow/finance-logs × guest/configurednonadmin fixtures →8negativecallercontractFAIL/received200/mockprivilegedqueries/auth-client/getUser/role0calls; expected401/403beforeprivilegedconstruction retained. Authflow8mockservicecalls, statsfakeRPCnotactualget_api_metrics_stats/WB177untouched.7controlsPASS:4invalidquery400 beforeclient, existingguardedfunnelguest401/nonadmin403/roleerror503. Rolefixturesnotconsumedbyunprotectedexports, notactualauthenticatedsessions/serviceimpersonation. Separateoutsideapps/webharness/config excludesnormal485inventory/coverage, no hidden skips/countsadded;9copied/originalsourceSHAmatch/current906c396c unchanged. Fullmiddleware source refreshesauth/errorcookies/headersbutreadsno user/role fordenial; AdminLayoutpageguardnotproofexportaccess. No actualpipeline/deployedresponse claim. SEC01 remainsblocked/RISK-ADMIN-API strengthened/no runtimeSQL/sourcefix beforeliveproof/no API/OAuthpolicybypass. FreshCUAinventoryempty/manualrootpending/notreasked/dev7512:3000present/probe3101gone. Artifacts global15stageG050/caller-tests/observations/result/source-equivalence; no realdata/entities/grants/nativechange/deploy. NextG051 boundedmiddlewarefixtureoravailableliveafterhealthyUI; deadlineunchanged.

G049 finalized23:57:19: owned auto-stop completed23:55:52/SIGTERM intentionally/runnerexit0; actual3101listenerandPID18820gone, dev7512:3000stilllistens/source906c396c unchanged. No persistentprobe/no cleanup/foreignkill/HTTP requests. G047/G048/G049 ALL completed/do not poll/relaunch; nextG050 allowedBASE/SECsupportoractualhealthyUIaftermanualrecovery. Full build/boot proof is intentionally dummy-env/warmcopy, not production-profile/live smoke/GO; REL02 keepsqueueddependencygate.3newlivefixes unchanged/zeroarea closure/lint53/167+3metadataFAIL remain.

15OctG047–049 technicalproductionprobe: narrowly permitted exact copiedPostCSSworker/127.0.0.1/argv2IPC(not3000), otherNodeTCP/allfetchstilldenied;14standaloneharnesschecksPASS(notwebcoverage). G047defaultNext16.0.11Turbo compile-onlyPASS25.8sec, G048exactnextbuildPASSexit0/compiled21.4sec/types/7workers/36staticprerenders. No compiler/root/typecheck-ignore workaround; copiedSentrysideeffectsdisabled/dummy.env(no.envfiles)/warmG046workspaceoutsideapps/web. Source906c396c/primaryconfig518a6abdunchanged. G049 isolatednextstartReady3.9sec, actual127.0.0.1:3101PID18820listenerchecked23:55:02 alongsidedev7512:3000. No HTTP/page/API/auth/RPCcalls/realDBrequests/deploy; Ready/listenernotliveproduction smoke/REL02orGO; lint53/167+3metadataFAIL remain. Auto-owned stop60secafterReady/max120sec; stdin-stop unavailable, do not rerunTTY/killdev; verifyclosure. FreshCUA inventorystillempty/manualrootpending/notreasked/bypassed. Proofglobal15stageG047/G048/G049/logs/results/copymanifest; no newproductbug/fix/entity/grant/nativeedit/cleanup.

G046 completed23:46:17UTC/exit1/no timeout: own diagnostic TCP guard blocked required Turbopack PostCSS-worker localhostIPC; NOT a confirmed Kezek/CSS/compiler-source failure. Exact generated createIpc({host127.0.0.1,portargv2}) and copied .next/build/postcss.js inspected. Source906c396c unchanged after run; primary config518a6abd retained. No all-primary-cache before/after hash claim. Preserve log/result/copy-manifest; job96368 completed/do not relaunch sameguard. NextG047 may allow only that exact copiedworker/127.0.0.1/argv2port excluding3000, retaining allfetch/otherTCP denial/dummyenv/Sentrydisable/defaultcompiler. No fullbuild/start/live/production PASS or new bug. Remaining lint53 errors across34files:16set-state-in-effect/3preserve-memo/13console/1immutability/5require/5error-boundaries/5refs/5rules-of-hooks; no blind behavior rewrite to green.

15OctG046 isolated compile diagnostic RUNNING96368: copied1618files verified/current906c396c source except explicit copied Sentry telemetry/upload/release disable; primary config518a6abd untouched/port3000PID7512 retained. Copy outside apps/web to avoid recursive tsconfig pollution; no .env/cache/node_modules copied, existing dependency junctions/no install. Allowlisted nonsecret OS env/dummySupabase/.invalid/site/empty credentials plus child-only Node TCP/fetch deny (not OS firewall). InstalledNext16.0.11 defaultTurbo build --experimental-build-mode compile; no compiler/root override. Warnings workspace-root inference/Sentrypartialcompile/middlewaredeprecated retained. Not fullbuild/prerender/start/production-env/UI/release PASS or liveproductbug; REL01 remains53lintErrors/3metadataFAIL. Resume existingjob/no duplicate,10min/winddown guard; copiedworkspace retainedignoredroot test-results. Fresh CUA stilltabs[]/manualrootpending/notreasked/bypassed. No DB/entity/grant/native/commit/deploy changes. Proofglobal15stageG046/copy-manifest/log.

15OctG044–045 technicalonly: slotloadernonreassignedignorefalse let→const/no asynccancellation/racefixclaim.3relateds9PASSbeforeafter/types/scopedlint1error→0/1olddependencywarning. Freshfull1052files53errors167warnings0fatalFAIL. Sourcehash906c396c… afterconst meansG043full485snapshot historical/nofakecurrentfullPASS. G045 exactconfiguredcorepaths25s251testsPASS/collectCoverageFrom26libfiles unchanged60gatePASS:73.82stmt/71.51branch/76.31fn/78.52lines,0skippedmetrics. Notallweb/shared/UIcoverage/readinesspercent;251overlapfull2061,notadded. Known3Telegrammobile-sourceFAILremainfullbaseline/no nativechange. Proofglobal15stageG044/G045/coverage-g045; no liveproductfix/data/entities/grants/DBwrites. UIstilltabs[]/manualrootpending/no repeats/bypass;3WB187–189+WB182followup/WB190OPEN unchanged. NextG046readonlyisolatedproductionbuildreview, no primary.nextcollision/deploy.

15OctG043 fullcurrentconfiguredinventory finished23:15:27UTC:485executed/483suitesPASS2FAIL/2061testsPASS3FAIL/0pendingtodo/crashes,61fresh8suite512MBbatches. Initial/finalhashd38977b0… matchesdeclaredsource/configscope; no sourceedit/skip/rulerelax/nativeproductchange. Same3Telegrammobile-source metadataassertions remainFAIL; notnewlivebugs/nofullgreen/release/coverage/buildPASS. OldG028483/2031 preservedhistorical/nonadditive. G040lint54errors167warnings separateFAIL/typesPASS. Job33050completedexit1/donotrelaunch; nextG044 scopedtechnicalorallowedliveafterhealthyUI. G042browserinventoryempty/manualrootawaited/server7512/8466Ready3000; no policybypass.3newverifiedWB187–189/WB182followup/WB190OPEN unchanged. Proofglobal15stageG043/baseline-g041-batches/final-summary.json; no app/DBcommands/entities/grants/deletion.

15OctG042environmentfailure: updatedCUAruntime lostbindings; freshgetState IAB2tabs[]/MCPApps1tabs[]/apps[], no old9/4orblockedpages interacted/reselected/newtabs/fetch bypass. PID8152/oldsession24528gone/TCP3000free; onlyownapps/webpnpmdev restoredReady17.7sec/PID7512/session8466/listener3000. No freshbrowserGET/authPASS; asyncmanualhealthyrootaskedonce(newchangedenvironmentcondition), staffOAuthpreviousblocknotcleared. ExistingG041485job33050 continues216executed/920testPASS3FAIL/0crash/269remaining at23:13—notfullPASS. No production sourceedits/data/entities/grants/deletion; no newproductfix. Proofglobal15stageG042; deadlineunchanged.

15OctG041 technicalbaselineRUNNING: actualcurrentJestinventory485uniquewebsuites,8/fresh512MB/180sec boundeddiagnostic. Newrunnercopycorrect15Oct04:40deadline/preflightguard; old14runnerunchanged. Initialfingerprintd38977b0…; no production sourceedits duringrun, no3knownTelegrammobile-sourceFAILhidden/nativefix/rulerelaxation. Session33050/global15baseline-g041-batches; resumeexistingjob/notduplicate. NotfullPASS/E2E/livecaller/coverage/build/release. Current54lintErrors167warnings separateFAIL;3newverifiedWB187–189/WB182followup/WB190OPEN unchanged. No app/DBcommands/entities/grants/deletion.

15OctG040 technicalcleanup:12literalJSXquotes→quotentities only4data-deletioninstructionstrings. Livewholemaintext3169charactersexactequalbefore/normalreloadafter, SHA3b7fd03e… unchanged; no policy/timelines/authinstructions/permissions altered orlegalaccuracyclaim.1s4testsPASSbeforeafter/typesPASS/scopedlint12errors→0. Freshconfigured1052files54errors167warnings0fatalFAIL, no rules/skips/nativechanges; oldG03566 historical.3distinctverifiedWB187–189unchanged/WB190OPEN, nowholeareaPASS. Proofglobal15stageG040/g040fullLint;9RUread-onlypolicy/4ownSELECTdraftmarkedhandoff; no deletions/datawrites/newentities.

15OctG039: actualanonymousbranch1/master1bfd/service5157/day19→BackDay20 stilloffersselectedmaster despite advertisedavailable-by-date. Freshauthorizedreadonlyeffective_day19week09–18/20weekintervals[] confirmsWB190OPEN; notfixed/maskedbycopy/no broadprivilegedprojection. FinalStep5offdayNoSlots+ChooseTimeddisabled PASStargeted; return19restores12starts14:15–17:noTimeclicked. Preservedmaster/servicesondatechange observation notseparatebug orblindreset. Currentrun3newverifiedWB187–189unchanged; nooutside-schedulebooking/security/fullareaPASS. Evidenceglobal15stageG039; onlydraft+addressedSELECT/no commands/entities/grants/schedulewrites.9RUstep5branch1/day19/noTime;4ownSELECTdraft.

15OctG038 historicalWB182calendarfollowup: actualKY19ARIA Russian vsKYsummary. Reuseexistingdeterministicdayhelper with business-zone calendar conversion; same-liveKY19->20->19 labels/summarycorrect, EN/RUlonglabelsretained, RUrestored. Before1FAIL2PASS finishedbeforepatch; after3s45PASS/types/scopedlint0errors1oldwarning. Not4thnewbug:current3WB187–189 plushistoricalfollowup. No slot/hold/entity/status/SQLcommands; branch2/day19draft preserved. ProofstageG038before/after/calendar-ky-after.png; wide/oddscaleNOTresponsivePASS. Allareasremainpartial.

15OctG037 WB189: earlybooking Step1/2 EN/KY guidance/status/counter/calendarstaticARIA stayedRU. Missing13wizard+4datepickerkeys/locale andneutralcounttemplate corrected; same-liveEN/KY/restoreRU keepsbranch2/day19. Before6FAIL9PASS finishedbeforepatch; after3s26PASS/types/scopedlint0/0. Currentrun3distinctWB187–189, no wholelanguage/areaPASS. KYdynamicdayARIA stillRussian: historicalWB182follow-up G038 next, notfixedbythisdictionarypatch. Evidenceglobal15 stageG037before/after/early-copy-after.png; screenshotwide/oddscale, noresponsiveclaim. No domaincommands/entities/grants/deletion/nativechange.

15Oct04:20Bishkek G036 WB188: actualanonymous branch1/day19/master1bfd/service5157 selected→BackBranch→branch2 showsNoStaffbutoldmaster+Nextenabled. Minimaluserbranchcallback nowresetsstaff/servicesonlydifferentbranch, leavesinitialURL/OAuthrawrestore/dateunchanged. Same-live fullrepeat/samebranchpreservesdraft/differentbranchNoStaff+emptyselection/Nextdisabled/settledURLnostaffservice/reloadafterhydration PASS. Before1FAIL4PASS completedbeforepatch; after3s15PASS/types/scopedlint0errors0warnings; scopedhookcoverage91.52/76.92/100/92.07 passes60gate (5tests overlap15, no globalcoverage). Currentrun2same-liveWB187–188, no wholearea/securityPASS. Browserdraft9branch2/day19/staff+serviceemptyRU; no slots/hold/create/cancel/status/package writes. SourceAPI/RPCrisknotfixed andoldG03566fullLintmeasurement precedesthishookedit; fullbaseline/build remainopen. Evidenceglobal15 stageG036before/after+screenshots; native untouched.

15OctG034–035: фактический callgraph2bookingguards+4delegates прочитан полностью черезreadonlypg_proc/SupabaseUI4, bodySHA сохранены. Guards обеспечивают время/филиал/пересечение, но неcallerauthorization; legacy9argpostgresSECDEF/BYPASSRLS не получает защиту от одного ENABLE RLS. Это deployedкодовыйриск, НЕ выполненная неавторизованная RPCкоманда/утечка/фикс. Фактические singlecolumnFK иno_overlap также неcallercheck; границы остаются открыты. G035технически2let→const без измененияповедения/прав; scopedlint2FAIL→0PASS, finance3testsPASSbefore/after (не новыеliveфиксы), typesPASS. Свежийполныйlint1052файла66errors167warnings0fatalFAIL; no skips/rule relaxation/nativechange. Wholebaseline/build/coverage не закрыты, текущийrun всёещё1same-liveWB187. Newapp/DBentities0, старыеtestfixturesоставлены; RU9business2/4ownunsavedmetadataquerymarkedhandoff.

15OctG033 SEC02 адресныйSELECT через прежнюю SupabaseUI4: actualbookingsRLS=true/force=false/ownerpostgresbypass; legacy9argRPCSECDEFownerpostgresbypass/search_pathpublicextensions.20политик,4enabledOтриггера: analyticsinsert/update, branchguard, explicitscheduleguard. Ни RPCвызовов, ни DML/DDL/новыхgrants/ролей; это deployedmetadata, не liveэксплойт/неполныйsecurityPASS. NextG034readonly тела двух guardфункций и вызванныхdelegates; WB177 не фикситьдоадминграницы. Healthy9biz2RUanonymous/4SQLunsavedmarkedhandoff, Google6blockeduntouched; ручнойrootrecovery не выдаёт новуюstaffсессию.

15Oct04:00Bishkek: новый запрос продлил работу до11:00 (05UTC), heartbeatkezek ACTIVEverified; новыйrun global-2026-10-15/G031–032, старые отчёты не переписаны. Остановленный localhost3000 восстановлен только своим pnpmdev/session24528/PID8152. Инструмент отклонил ошибочную receipt8, пользователь вручную открыл здоровуюroot9; никаких обходов. Сессияanonymous, старыйGoogleOAuthблокер не объявлен исправленным. WB187 countforms публичных секций same-live EN/RU/KY исправлены; 2набора36тестов/typesPASS, scopedlint0errors1oldwarning; no fullareaPASS. Старый483baseline не актуальныйпослеэтогоизменения. Новыхсущностей/ролей/удалений нет, тестовые данные оставлены. G032before-unitartifact невалиден как before, процесс завершился после sourceedit; exactliveAXbefore сохранён. Phone/tablet/API/RPC/independentroles/service-search/v1/build/baseline gaps остаются. Новыесценариистоп10:40/отчётPAUSEDдо11.

14Oct10:54Bishkek FINAL: новые сценарии остановлены с10:40, kezek PAUSED подтверждён04:46:57UTC и повторно проверен до11:00. final-report.json/globalstate/progress сохранены:9отдельных same-liveисправленийWB178–186, не полныйPASS проекта. Последний current483 прогон:481наборPASS/2FAIL,2031тестPASS/3FAIL/0skips/crashes; lint68ошибок167предупреждений. Финальная независимая проверка sourcehash9ab2fba5 совпала сG028; dirty326сохранены, безcommit/push/deploy. G030адресныйreadonlySELECT подтвердил hiddenservicee21545/150–275/branch2,5confirmed19Oct,034paid иpkg1. Старые ledger/review/audits оставлены, в этомSELECTне проверялись. Ничего не удалено, опубликованный график не меняли. Здоровая9главнаяRUloggedout/2бизнеса/пустойпоиск;4SQLunsaved/10receipt сохранены.6OAuthdataerrorpolicyblocked, ручное восстановление сотрудника ожидается; API/RPC/независимые роли/WB177/phone-tablet/service-search/baseline/production/deployed проверки открыты. Продолжение только по новому запросу/сроку.

14OctG028–029: currentfull483 inventory completedsource-stable9ab2fba5,481suitesPASS2FAIL/2031testsPASS3FAIL/no pending/todo/crashes, configuredlint1052files68errors167warnings0fatal. OldG025482/old480 retained/nonadditive; no release/fullcoverage/monolithicCI PASS. G029actualanonpublicBusinessApply hassignin-before-submission gate; RoleApply redirectsordinarylocalsigninwithreturncontext. No provider/formsubmit/Terms/permissions clicked, no applications/roles/data created. This is page-entryproof only, notAPI/moderation/fullSET05; local signin NOT workaround forblocked6OAuth.9same-livefixesWB178–186 unchanged. Newscenariosstop04:40UTC; finalreport/PAUSED05.

14OctG027: actualОш, улица cataloguequery breakswithservice-unavailable vspairedno-comma normalempty. WB186existingname/address PostgRESTOR operands quoted/escaped viaapp/lib helper, no newservice-searchimplementation/DB/grants/nativechange. Samecomma validempty/noerror, quotes+parentheses+colon+dot alsoempty; normalbusiness2name1correct preserved.6formatcasesFAILbefore,2s8PASSafter/scopedhelpercoveragegate,9distinctcurrentrunWB178–186. G025482source-stablefullresult remainshistorical beforethissourceedit; currentbaseline recheck required. Service-searchproductgap stillOPEN, no B1/role/RLS/responsive closure.

14OctG025–026: fullcurrentconfigured482 bounded8/fresh512MB source-stable finished04:00:45UTC:480suitesPASS2FAIL/2025testsPASS3FAIL/0pending/todo/crashes; same3Telegram/mobile-source metadata assertions retainedFAIL, excludednativeproduct unchanged. Measuredconfiguredlint1051files68errors167warnings0fatal, no fullgreen/release/coverage claim. All8distinctlivefixes alreadyrepeated separately. G026loggedoutnonexistentpublicreceipt0 ->safeNoRecord/no details/actions inRU/EN/KYclienttoggles ->restoreRU/Homeactualhref returns2biz/emptyquery PASStargeted, no realforeignrecord/auth/RLS inference. Healthy9rootRUloggedout,6OAuthnetworkdataerrorpolicyblocked/userrecoverypending. No newdomainwrites/sourcechangesG025/26; currentfingerprintafba91bf recorded, oldreports preserved.

14OctG024: cataloguebusiness2name→1, q+women category retained, nonexistentquery→0/empty/reset→rootemptyfield+2 PASStargeted. QueryLIVE TESTService31→0whilefreshpublicbiz2shows3active matchingservices; pagecodequeriesbusinessname/address only. GAP-PUBLIC-SERVICE-SEARCH missingadvertisedfunctionality OPEN /v1contractpending, not automaticallywidefeatureimplemented/not hiddenbycopy.2suites4navigationtestsPASSsupportnotservicecoverage;482currentinventory recorded,8distinctfixes unchanged. Healthy9publicbiz2RUloggedout;6Googleauthorize networkerrorpolicyblocked, usermanualstaffrecoverypending. No data/reservation/securitychanges.

14OctG022–023: ordinaryownerlogout thenGoogleauthorize networkchanged beforechooser,6newdata/errorpolicyblocked; no automaticbypass/retryalternate, staffcomparisonNOTPASS/manualuserrecoveryasked. Healthyexistingpublic9map2branches ->card2pressed/overlay+listbranch2href ->wizardbranch2preselected ->Mon19nostaff/noNext ->switchbranch1retains19showsownstaff/AnyMaster. No slotsselected/hold/reservation/booking/domainwrite;3currentexistingmap/context suites7PASSsupport.4s45schedule/date/modelPASS/helper100scopedcoverage, no fullSET03/PUB/visual/roleclosure.8distinctfixes unchanged. Tab9publicstep3branch1Mon19RUloggedout;6errorleavealone.

14OctG021: specificday in-memorydraft/Addblankinterval/Review -> validationmessage, noPublishbutton (targetedPASS). Reversed09/08Cua filldidnotretaincontrolledvaluesafterReview, so reversal liveNOTproven/no productbugassertion; modelunittests separate. ReloadRU clearsdraft/notice, actualcalendar19/26OctMon09–18branch1only/otheroff unchanged; no schedule/absence/domaincommand.8fixes unchanged, nofullSET03closure. G022knownstaffread-onlysamecalendar next.

14OctG020: WB185loaded-draftstatusKY->EN stayedKY liveconfirmed; storeknownsuccesskey, translateat render. SameKYreload/load->ENwithoutreload->RU showscorrectmessage andsame09–18draft/branch1/current19+26Octcalendar. No Publish/absence/booking/domainwrite; RUrestored.3suites34PASS/types/scopedlintPASS, overlapG019notadditive.8distinctcurrentrunWB178–185; rawerrorstrings/otherappnotices/allSET03remainopen. G021negativein-memorydraftvalidation next.

14OctG019: owner2/staff1bfd currentcalendarMonday19/26Oct09–18/othersoff andcancelledabsences intact; load currentplanGET into09–18draft, no publication. KG weekdayheadings stillRussian -> extendexistingWB182deterministicweekdayhelper, not eighthdistinctbug. Same all7KY/EN->KY headings correct; Review showslocalized explicitsecondPublishbutton, never submitted.3suites33PASS/types80508exit0/scoped2prodFileslint0. Screenshot unavailable/noresponsivePASS. Loaded statusnotice retains priorlanguage separatelyobserved/G020 next; SET03newstaff/no-publishedfixture/allconsumersstillopen.7distinctfixes unchanged.

14OctG017–G018: freshaddressedreadonlystaffSELECT confirmsknown1bfd/user55072889only1active/totaljob, WB054multi-job stillunprepared/notliveclosed/no newgrant. G018ordinaryownerowns2businesses: context2actualservicee215EditHref -> context1emptyservices/samehref404 -> restorecontext2sameeditor45/150–275/onlybranch2/inactive. Temporaryactivebusiness2->1->2 restored; no Save/Delete/input/role/recordwrite.3currentexistingservices/context suites25PASS supportonly, no independentforeignowner/RLS/API matrix closure.7fixes unchanged; tab6owner2readonlyserviceRU retained for explicitstaffschedule safeUI/draftpreview next, G009exactcancelawaitanswer.

14OctG016: currentclientname with staleowner rolemenu in neighbor publictab9 liveconfirmed, backendclientDeniedcorrect/no leakclaim. WB184roleSwitcherloadonce ->authsubscription/immediateclear/deferredSDKreload/generation/cleanup. Samepublic9 client->anon->ordinaryknownGoogleowner->openmenu->signoutother6->ordinaryclient without9reload nowclearsowner/menuandshowsclientonlyMyBookings. Seventhcurrentrun same-livefix;4suites10PASS/types42374exit0/scopedlint0errors/scoped60coveragegatePASS. role-menu-after.jpg captured, no mobile/tablet/wholeSECclosure. Onlynormalauthsessionchanges, no roles/profile/bookingDBwrites; exactf821cancelawaitsanswer. Nextsafeownerbusinesscontext/branch/service orschedulepreview, no publish/rolegrant/deletion.

14OctG015: readonly repeat regression afterClientCabinet/sharedTabs changes. Exactowncancelleda427Repeat preservesbranch/staff/service60min100–300, doesnotreuse olddate/time/status.15OctThu finalstepempty/ChooseTimeddisabled;19OctMonwarns5ownactive andshows12free60min starts14:15–17:00, excludes5occupied intervals/gaptoo-short/endbeyond18. No slotselected/command/newbooking,6fixes unchanged.3currentexistingrepeat/conflict suites12PASS supportonly, notatomic/caller/security/fullBOOKPASS. Clienttab6Step5Mon19RU retained, exactf821cancelstillawaitspecificanswer.

14OctG012final–G014: actual480configured inventory now completes source-stable478suitesPASS2FAIL/1997testsPASS3FAIL/noOOM/pending/todo; metadata3assertions retainedFAIL, nativeproduct untouched; configfullLint70errors167warnings0fatal. Later UIchanges invalidate thatcandidatefingerprint/currentinventory481, not fullgreen. G013WB183sharedbuttonTabskeyboard+ownpanelrelationships sameRUHome/End/Left/Rightwrap andKYRight livePASS, no entitycommand; sixthcurrentrunfix. G014sameWB182root deepfollowup caught Intl-only fixSSR/client mismatch; deterministicexistingcalendarutility now receipt/cardEN->KYwithoutreload andKYreloadcorrect/RUENpreserved, no duplicatebugcount. Final8suites58PASS/types61437exit0/scoped5fileslint0errors1oldwarning/calendarhelper100coverage. Quoteentitylintrepair renderssamepackagequotes/amount, technicalonly. G009exactf821cancelstillawaitanswer,5future/3history/package1of2 retained. Screenshots finalattempt unavailable; initialKYreceipt imageonlylimitedhistoricalproof, no phone/tablet/wholeareaPASS.

14OctG009–G012: client cancellation modal/back verified only; exact f821 final cancel awaits action-time answer, still confirmed. G011 receipt KY date live Russian -> Intl ky-KG -> same receipt corrected, EN/RU/timezone/status preserved; WB182 fifth current-run targeted fix, 3suites15PASS/types; desktop screenshot saved, no phone/tablet PASS. Receipt branch/address/duration/contact context remains v1 acceptance gap. G010 configured479 bounded diagnostic completed471PASS/1FAIL/7unresolvedOOM,1963PASS1FAIL/no skips/source stable during run only. Quickguest stale self-HTTP notification test adapted to real private dispatcher,4PASS. G012 real async persistence-port fixture/awaits let remaining7 suites finish72–84MB:5PASS2FAIL/27PASS5FAIL, no OOM/skips; assertions retained. Missing source/chat metadata and webhook fixture guard configuration are technical findings, NOT live-confirmed product/native fixes. Full baseline/lint/coverage/build still not green; old source fingerprint invalidated by later edits.

14OctG008: ordinaryowner signout -> loggedoutstaffnew routes to signin; normalGoogleknownlow.fade.osh clientcallback -> /dashboard denied. Samepureclient staffnew/hiddenserviceedit denied, settledstaffpage denied, adminpage global-super-admin gate, owncabinetprofile available correctcanonicalname/Google/ownemail. No grants/unlink/profile edits/delete/manualentitywrites. Existing4isolatedsuites42PASS supportonly;0newfix, currentrun4fixes unchanged. NotAPI/RPC/RLS/independent-manager/foreignowner/fullSEC03SEC04PASS; policyblock notbypassed,177notfixed. Client6/profileRU remains for ownbooking checks.

14OctG007: WB181sameblankstaffnewRU/EN/KY warning/hint liveconfirmed ->2manualOverridekeys/language +singleparentheses JSX; sameKYreload/EN/RUswitchPASS, no lookup/selection/submission/role/datawrite. Final4suites30PASS (27WB178overlappingnotnewcoverage+3newcases), types/scopedlintPASS.4targetedfixescurrentrun, nowholelifecycle/language/security/visualPASS. Nextavailablecurrentcandidateclient/owner boundaries beforebroadUXwork; no extraaccounts requested/rolesfabricated.

14OctG006: WB180 publicbusiness2 actualEN/KY productcopy stayedRU despite workinglanguageswitch ->33 visible businessdictionary keys +translated maplabels; samepageKYreload/EN/RUswitch nowcorrect, links/names/addresses/servicecount3 unchanged.6new testsFAILbefore ->3suites14PASSafter/typesPASS/scopedlint0errors1oldimgwarning.3targeted same-livefixescurrentrun, nofullpublic/language closure. EN1specialists grammar remainsobservedgap; headerАккаунтвладельца derivesprofilefull_name, not a literalcaption, no rename/fixclaim. No newDBdata, RUrestored; screenshot/mobile/tabletproofstillblocked.

14OctG005: targeted SET-01 service lifecycle and historical WB082 followup. Owner new duration clears to real empty then30, saved30. New hidden fixture vanished from management and lost saved branch in edit -> WB179 minimal management-only projection fix; same-ID list/edit/name/duration45/prices150–275/activate/publicRUENKY/deactivate repeat PASS. Final hidden retainedIDe21565db-8dc1-41df-b6e3-0dc9d16b040a onlybranch2, no staff/bookings/finance effect, original services preserved. Final5suites20PASS/scoped page60coveragegate/productlint0errors; currentrun2same-livefixes, not whole SET01/area/release PASS. Public landing static Russian copy inEN/KY newly observed, pendingG006. Screenshot capture unavailable, no visual/responsivePASS.

14Oct06:30Bishkek globalG003/G004: addressedreadonlySupabase confirmed7/9argcreate_internal_booking and3argmetricsRPC SECDEF/anonEXE/authEXE; actual9argbodydirectinsert/nointernalcallercheck. No RPC execution, grants/DDL changes or liveexploitclaim; explicitcaller/trigger-boundarygap remains. Fourisolatedsupport suites12PASS are notsecurityPASS. G004ownerblankstaffsearch listed7globalprofile/emailrows -> WB178 UI+HTTP+servicesmallguardfix; same-liveblank/space/knownclientEN/KY/RU, no employee/account/rolecreated, RUrestored. Final4suites27PASS/types/scopedlint0errors1oldwarning/service60gatePASS;1newfix innewrun, oldcounts separate. Currenttab6owner/staff/new; manualoverridewarningRUinEN/KY anddoubleparentheses remainobservedunfixed, pendingWB082/SET01live follow-ups next.

Актуальная общая цель и очередь с14октября: [WEB_GLOBAL_READINESS_PLAN.md](./WEB_GLOBAL_READINESS_PLAN.md). Решения по82 областям и33 пакетам работ: [WEB_GLOBAL_READINESS_STATE.json](./WEB_GLOBAL_READINESS_STATE.json). Этот трекер сохраняет сценарии и историю; старые записи не являются решением о готовности текущей сборки. По отдельному запросу пользователя14октября начат global-2026-10-14 до11:00Бишкек; новые сценарии прекращаются10:40, heartbeat ACTIVE. G001–002: среда готова,321кандидатных пункта проверки не являются выполненными тестами; текущие4аккаунта без новых ролей, responsiveBLOCKED, продуктовых исправлений нового run пока0.

13Oct18:41Bishkek final winddown: new scenarios stopped at18:40; kezek automation PAUSED, tool response and saved setting verified before19:00. Current run21same-live targeted fixes WB156–176 (day17), not whole-project PASS. Fresh read-only Supabase pg_proc confirmed deployed nested aggregate for open WB177; no function/grant/migration fix. Stage051 API boundary remains browser-blocked and code-only risk, no bypass. Final-report-1900.md/progress saved; morning report and retained fixtures preserved, temporary settings restored. Latest11suites40PASS/typesPASS; responsive/API/RPC/full catalogue gaps explicit. No commit/push. Resume only on user request.

13Oct18:28Bishkek stages050/051 M1/M6: knownordinaryGoogleglobalSuperAdmin enters/admin; health+monitoradvertisedroutes wronglyredirect/admin WB174 fixedclientpagesdelegateunchangedparentglobalgate. Sameadminbothreadpages; normalGoogleownersameURLsdenyNeedsSuperAdmin/nodiagnostics, restoredbiz2RU/dashboard. WB175canonical/admin/api clientpaths nowloadhealthdata/monitoringactualmetricrows+finance13Octtestlogs instead404HTML; StatsseparateWB177OPENnestedSQLaggregate. WB17651mojibakeRUlinesmechanicallyrepaired/readableheader/tab/forms/tables, nofullKY/ENPASS.3suites6tests/types24691PASS/lint0errors1oldwarning; consolidated11suites40PASS final-targeted-regression.json coversrecentchanges/notwholeproject. Directloggedoutmetricslimit1browserBLOCKEDnetERR_BLOCKED_BY_CLIENT/tabstayedsignin; nounauthorizeddata/no bypass/code-onlymissingcallercheckriskunchanged.21currentrunfixesWB156–176/day17, no newentities/schema/grants/roles/sales. Cutoffnewscenarios12:40UTC/reportPAUSEby13UTC.

13Oct18:03Bishkek stages048–049 L2/L4/O: Temporarilyplan47adaactivefalse normalConfirm; originalsoldpkgactive1of2/until11Nov stilllisted, QuickDesknewSellNoactiveplans/disabled. Editorrestoredtrue withnames/2/30/0/servicebranch1unchanged; sameSelloffercorrectenabled no submission. No newpackage/entity/attendance. Stage049WB173 Englishdialog options/summaryRussian terms reproduced, sharedformatter+3languagekeys fixedsame-liveEN/KY/RU2/30/0%.3newtestsFAILbefore/post3suites9PASS/types26960/lintclean, fixedpriceonlycomponentcovered. RUrestored/Cancelmodal/ownerbusiness2QuickDesk idle;18same-livefixesWB156–173/day14. ActiveplanAPIstale/redeeminactive/expiry/depletion/refund fullmatrix remainsgap.

13Oct17:50Bishkek stage047 K1/F4 PASS targetedwithgaps: ordinaryownerallstafffinance13Oct650/600/50/1closed matchesexact909employeeStats/currentworkspace. Branch2filtersettlesall0/noemployee, branch1restores650/600/50/correctstafflink, originalAllbranches restored. No newwrites/fix;17currentrunfixesunchanged. Foreign/API/monthyear/historicalassignment notPASS.

13Oct17:47Bishkek stage046 K1/K2/K4 targeted: temporaryownerUI testbranchTue09–23/staff13Octexception/rate300 enablednewshift909e4eb8, manualitem2e5ed7f4 LIVE TEST FINANCE13OCT600/50. Normalclosedshift/hours2 gives guarantee600/topup240/master600/business50. WB171 Stats600vsworkspace650 commonbasis fixedsame-live650/92.3%/7.7%; WB172 topup600vs240/base600vs360 fixedsame-live240/base360/guarantee600; repeat0.02h guarantee6 produces0topup/noguaranteeflag. FreshSQLsameIDs confirmsclosed2h/600/50/600/50/600/240, old256stillclosed/NULLhours/rate/zeroitemsandamounts. RestorehourlyNULL/60:40 andstaffordinaryoff andbranchTueclosed verifiedfreshUI, Mon19unchanged. Retainnewclosedshift/item, affectsfinanceandlateness516 artificialminutes; no realmoney/schema/grants/oldshiftreopen.4suites18directJestPASS/types74000/coverage116of144statements15of16functions77of119branches gate60PASS; productionlintclean/testsignoredwarning. Initialnpmstrippedflags, before4FAIL2PASS terminalonly (no claimedJSON); finalartifactfinance-money-verified.json.17currentrunfixesWB156–172/day13. Hourscorrectionaudit/guaranteeexceedsreceipts/fullfinance remainpartial.

12Oct16:59 stopcheckpoint: userchangeddeadline17:00; automationPAUSED10:58:42UTC. Currentrun22same-livefixesWB134–155/14resumed (not historicalnight51 and notwholePASS). WB153Retryactualrestore; stage024 actual16:20ownerNoShoweaa3f7e5/statuspersisted/package2unchanged. Stage025plan47ada482→clientpackagee485ccd9 sale/ownerbranchfilter/client2of2/11Nov PASS targeted, no realmoney. Stage027WB154terminalNoShowwrongupcoming/actions/labels fixedsameIDHistory/receipt; WB155nestedlocaleprovider fixedRU/ENsamepage.25targetedtests/typesPASS; extended26testsPASS butcoverageFAIL54.14branches/48functions. No newscenariosafterdeadlinechange. Futurefixture03469725confirmed17–18 leftforlaterattendance/packageconsumption, notmarkedearly. Dataretained/no commitpush. Furtherpackage/refund/review/hourly/tenantRPC/notifications/visualgaps remain. See final-report-1700.json.

15:34Bishkek stage023WB153retry confirmedactualcachedservererror/noGETthenfixedrefresh+resetReacttransition. SameerrorafterHMR→ordinaryRetry restoredbusinesscalendarbranch/date, no browserreload; draftstaff/service validationseparate.2suites7tests/targetedcoverage/types/scopedlintPASS. ExternalDNSfaultnotfixed. Currentrun20same-livefixesWB134–153/12resumed. Preparingoneactualfutureclient12Oct16:15 fixture forno-showafteractualstart, noclockbypass.

15:15Bishkek stage022: ordinarypureclient cancela4278f13count2→1, primarysameIDcancelled. Futurecancel hiddenfrombothtabsWB152fixed ownscope historyOR pastdate/cancelled plusRU/KY/ENHistorycopy. SameIDreloadhistorycount1/cancelled/noCancel, upcoming14c108f6still1;26Oct09enabled/noactivebookingblock confirmsrelease.4suites14types/scopednewquery+copylintPASS. WB151hooktargetedcoveragefinal13testsPASS, statements54/59/functions5/6/branches14/17; initialcoveragefailkeptseparate. Currentrun19same-livefixesWB134–152,11resumed. KYdateRussianmonthobservedunfixed; fullrole/RPC/race/payments/notifications/visualmatrixgapsremain. No deletion; markedtestdataretained.

14:55Bishkek stage020/021: usermanuallysigned separatepureclientlow.fade.osh@gmail.com. Owner/staff/adminUIrouteguards deny; ownGoogleprofile saved LIVE TEST CLIENT12OCT (originalblank/phoneblank). Firstany19Oct09created14c108f6 but selection-triggeredURLnavigation lost receipt WB151. Fixedlocalcommandstaff/not parentnavigation; same-liveactual26Octany09 confirms and autoopensa4278f13receipt.4suites17tests/typesPASS; scopedlintoldHEADwindow.location.hrefFAIL. Twoownfixturesretained. NarrowUUIDpublicreceipt intendedno contacts/actions, notprivateRPCallowedproof. DNS transientnetworkfailure separate; retryrecovery unresolved. Currentrun18same-livefixesWB134–151,10resumed; pureclientcancel/privacy/fullmatrix next, notwholePASS.

14:05Bishkek: WB149complexcabinetlabelsRU/KY/EN fixedsame-live (3suites8tests), WB150noaggregates!=zeroanalytics fixedpresentation only (5suites18tests). Types/scopednewfileslintPASS. Primaryreadonlystats0rows; actualaggregationcron/backfillstillgap, nofake0/adhocDBrecalc. Existingmanualshiftclosed0remainsunchangedafterlaterattendance, stage019readobservationnotfullfinancePASS. Currentrun17verifiedWB134–150,9resumed; wholeprojectgapsremain. UseragreedaddpureclientGoogle,addresspending, continueothers. RUrestored/dataretained.

13:35Bishkek stage014targetedstatusPASS: actual07:30UTC afterstart ordinaryownerПришел>confirm turns1308c17bpaid; Refresh/UIoneID/primarySELECTcorrectstaff/branchpaid. No realpayment, fixture retaineduserinstruction, downstreamfinancial/package/analytics effects notyetverified. BeforestartonlyCancel; no clock/rolebypass. Currentrun15fixesWB134–148; WB149RUcomplexcopyopen; stage015/0167suites25types/helperscoveragePASS but oldBookingCard2quoteerrors/scopedlintnotPASS. Nextstage017anddownstreamstatus checks, no fullH3/D6PASS.

13:28Bishkek stage015/016: WB147Повторить wrongbusinesslanding fixeddirectbookingcontext/currentdate, same-live loadedstep4. WB148pastcomplex31a39be7 cabinet60/onevsreceipt61/two fixedexistingvisit-servicejoin+snapshotadapter; samecardreload61/bothandURL2IDs.7suites25tests/types/2purehelpers100%coveragePASS; scopedlint2oldquoteerrors1existingwarning,notfullPASS. Currentrun15verifiedWB134–148,7resumed. No newrepeatbooking submitted; currentcompetenceonlyprimarynotbypassed. RUcomplexlabelsServicesinvisit/Total liveWB149open. Stage014oneconfirmed1308c17b13:30–14:30retainedforactualclockstatuscheck, notdeleted.

12Oct12:41checkpoint: пользователь продлил активную работу до19:00Бишкек (13UTC), winddown18:40; та же автоматизацияACTIVE обновлена. Новые отмеченные данные оставлять, учитывать и не удалять автоматически. Прежние4финансовые строки удалены до этого решения с отдельным подтверждением; пустая сменаclosed. Stage013staff ordinaryUI walk-inLIVE TESTSTAFF12OCT15–16 создан/чекправильный; владелец ordinaryGoogle прочитал/отменил тотжеID8b31e15e до нового решения, freshSELECT/UIhistorycancelled. Аудитсохранён. Консолидированная затронутая регрессия19наборов114тестовPASS (пересекается с прежними, не суммировать),typesPASS.13same-livefixesWB134–146currentrun,5resumed, не полныйPASS. Продолжитьstage014,no commit/push.

12:16Bishkek: WB145staffsidebar mixedtechnicalcopy andWB146explicit scheduleheadingRUonKY/EN live reproduced/fixed/repeated. RU/KY/EN nowlocalized; thinclientpresentation retainsservercontext/guard/calendarendpoint. Next14days read-only26Oct–8Nov navigationPASS targeted; fullschedulematrixnotcompleted.4suites21tests/typesPASS; scopedlint0errors1existingwarning. No new data; RUrestored, emptyfinancefixtureclosed. Currentrun13verifiedfixesWB134–146,5resumed, not wholeprojectPASS. Evidence stage-012-staff-workspace-locale.json.

Checkpoint12:05Bishkek (12Oct continuation): WB143 presentation basis fixed/live repeated: staff open and closed/reloaded summary300=services251+materials49, shares151149; actual downloaded CSV matches300/251/49. WB144 summary title/export label/help live RU/KY/EN now localized. 5suites21testsPASS, helper targeted100%coverage, types/scoped6productfileslint/whitespacePASS. No payout-engine/storage change. Marked row eb63528d removed ordinaryUI explicit user approval; final freshSELECT closed/items0/allamounts0, empty audit/download retained. Currentrun11verifiedfixesWB134–144, resumedwindow3WB142–144, not whole-projectPASS. Sidebar/CSVheaders, hourly/guarantee/RPC/foreignroles/pureclient/responsive remain gaps. Evidence stage-011-summary-revenue.json. Prior stop report preserved; automationACTIVE until13:00 with12:40winddown.

Обновлено: 2026-10-12
Ответственные: пользователь + Codex  
Текущая среда: `http://localhost:3000`
Статус: активный полный прогон

## Продолжение веб-прогона 2026-10-11 — предварительные проверки

### Продление пользователем до13:00 12 октября

Checkpoint11:37: WB142 подтверждён живьём — один ручной клиент после одногоSave иавтосохранения20сек превращался в2persistedстроки и удваивалservice/consumables. Введена постояннаяUUIDидентичность черновика, передаваемая optionalclientId; повтор сохраняет ту же строку, а не дедуплицирует людей по одинаковому содержимому. СуществующиеIDпринадлежатсмене, collisionlookupfailclosed; миграций/grantsнет. Тот же сценарий послефикса оставил1строку; закрытие иreload сохранилиID/created. Процентный вариант60/40 с251услуги+49расходников дал151сотруднику/149бизнесу вUIиSQL, в открытом и закрытом состоянии. 6наборов45тестов/targeted2modulecoveragePASS после расширения регрессий без снижения порога; typesPASS; scopedlint0ошибок16старыхwarnings. Всего9same-livefixesWB134–142, из них1новыйвпродлённомокне. LegacyбезclientId иполнаяconcurrency/versioning/tenantматрица не закрыты.

Пользователь отдельно подтвердил удаление толькоcreatedLIVE TESTFINANCE12OCTстрок; 2дубля+1повторнаястрока удаленыобычнымUI, восстановлениячерезUIнет. FreshSQLподтвердилshiftclosed/items0/allamounts0. Адресная очистка завершена; coreаккаунты/бизнесы не затронуты. Отдельно WB143open: headline«Общийоборот»251 приdetailTotal300 иsplit151/149 — не дефект движка, а неоднозначное основание представления. Доказательстваstage-010-finance-save-duplicate.json.

Пользователь разрешил продолжить. Новая граница07:00UTC, завершение/очистка с06:40UTC; реальное время проверяется перед каждой записью в приложении/БД. Существующая автоматизацияkezek вновьACTIVE, срок обновлён, не создан дубликат. Оставшаяся пустая смена закрыта обычным действием сотрудника; freshread-onlySQLподтвердилclosed10:54:27.51Бишкек, items0,hoursnull,все суммы0. Это отменяет прежний остатокOPEN в историческомfinal-report.json, который не переписывался. Доказательстваstage-009-resume-cleanup.json; WB138 дополнительно подтверждён наstaff-close, не новый баг. Продолжаются непроверенные сценарии, прежние8fixesне засчитываются повторно.

### Завершение продолжения: срок превышен, автоматизация PAUSED

Последняя проверка времени после обычного переоткрытия тестовой смены показала04:03UTC/10:03Бишкек, позже заданного09:00. **Остановка не была своевременной**; после обнаружения срока новые изменения приложения/БД прекращены, только read-only проверка остатка и сохранение отчёта. Автоматизацияkezek переведенаPAUSED, статус подтверждён ответом инструмента и сохранённой конфигурацией. В этом продолжении8новых same-livefixesWB134–141; исторические51не прибавлены и не повторно выданы за результат.

F1/F4 точечноPASS: владелец/сотрудник не допущены в/admin; гость перенаправлен на вход; обычный Google-вход obraz.osh приводит в/staff; сотрудник не допущен в/dashboard даже послеreload и по скопированной ссылке финансов владельца. Собственные финансы доступны, добавление клиентов в закрытую смену заблокировано. Полная tenant/API/RPCматрица, отдельный менеджер/чужой владелец/чистый клиент не проверены. Денежный положительный сценарий не выполнен: строка не добавлялась.

**Остаток для очистки: пустая тестовая смена256a0610-676a-450b-b909-0ecccccd5edc сотрудника1bfd0e3b теперь OPEN** — последнее переоткрытие отменяет прежний checkpoint «closed». Read-onlySQL подтверждаетitems0, все суммы0, hoursnull, closednull; opened04:47:51.396 сохраняется. После срока закрытие не выполнялось. В текущей вкладке/staff/finance доступно «Закрыть смену»; нужен пользователь или новая инструкция. Тестовая бронь4e30608aотменена, неактивная акцияN4сохранена. Очистка **не полная**, никакого реального платежа не было.

Итог и точные границы: apps/web/test-results/live-2026-10-11/final-report.json иstage-008-role-boundaries.json. Типы/адресные регрессии проходят, но общий suite/lint/coverage не объявленыPASS; отдельное financecoverageнижеthreshold. Все области веба не закончены; emailдомен, Yandexcallback, рольчистогоклиента и реальнаяresponsiveматрица ограничивают прогон. Commit/push не выполнялись, существующие изменения сохранены.

Checkpoint05:11: WB141 два неназванных финансовых поля подтверждены nativeAX и исправлены (существующий label даты связан сinput черезuseId, часам дано имя из словаря). Тот же экран RU/KY/EN теперь объявляет имена, редактор отменён без сохранения. 3набора17тестов, types и scopedlintPASS. Сейчас8новыхsame-livefixes WB134–141. Полный screenreader/keyboard audit этим не закрыт. Следующий этап — доступы ролей и границы кабинетов.

Checkpoint около05:07: WB140 наблюдавшийся английский текст финансовой статистики исправлен через словари RU/KY/EN, включая metadata/фильтры/период/таблицу/кнопку сохранения. Тот же экран, раскрытая смена и редактор повторены в трёх языках; редактор каждый раз отменён, RUвосстановлен. 4набора23теста и typesPASS, scoped8productfilelintPASS; старый require в этом файле заменён обычным импортом без отдельного «продуктового исправления». Сейчас7новых same-livefixes WB134–140, не весьвебPASS. **Последний native screenshot теперь получен**, но огромный canvas/без сохранённого файла и без фактической responsive-матрицы; прежние этапы по-прежнему доказаны AX, не снимками. Подробности stage-006-finance-translations.json. Без новых данных; пустая смена осталась закрытой. Неназванный input часов live наблюдён как отдельный вопрос доступности; K2 пересчёт/аудит, K1формулы и роль/границы бизнеса остаются приоритетом.

Checkpoint 12 октября около04:55: живой цикл владельца «открыть пустую смену → закрыть → статистика → исправить часы» выявил WB138/139. Ручное закрытие писало будущую полночь следующего дня; теперь сохраняет фактический момент, тот же цикл подтверждён UI и read-only SQL. Пустые часы раньше сохранялись как0; теперь отвергаются без записи, явные2 успешно сохранены и прочитаны. Обычное переоткрытие/закрытие восстановило hoursnull. Оставлена одна пустая закрытая тестовая смена256a0610-676a-450b-b909-0ecccccd5edc (opened04:47:51.396, closed04:48:34.955, items0, все суммы0), без необратимого удаления. Сейчас6новых same-livefixes WB134–139. Поддержка12наборов/64теста и typesPASS; scopedproductlint0ошибок/8старыхwarning. Исправлен устаревший ledger-мок happy-route, не ослаблена409защита. **Targetedcoverage двух сервисов ниже порогов**, полный financePASS не заявляется. Часовая гарантия/округление/аудит коррекции и staff-providerUI остаются непроверенными. RU финансовая статистика содержит live-наблюдавшиеся английские fallback-тексты (WB140), пока не исправлена. Доказательства stage-005-finance-hours.json; скриншоты по-прежнему недоступны.

Возобновлено по запросу пользователя. Сервер запущен на `http://localhost:3000`; прежние staged/unstaged изменения сохранены. Старые вкладки приложения находятся на документах ошибки подключения, которые браузерный инструмент блокирует по URL policy. Пользователю предложено вручную открыть обычный `/dashboard`; запрет не обходился. **Новых продуктовых live PASS/исправлений на этом checkpoint нет.**

- Поддерживающие проверки авторизации/команд: 5 наборов / 60 тестов PASS.
- Повтор семи ранее проблемных веб-наборов сначала дал 6 FAIL / 1 PASS. Исправлены только устаревшие тесты: текущий дополнительный lookup владельца WhatsApp, обязательный OTP-шаблон, предварительное чтение при наследовании контактов филиала, русский словарь вместо fallback-мока, собственное окно подтверждения удаления финансовой строки, локализованные допустимые фразы удаления аккаунта. Проверки прав и блокеров не убраны; добавлены сценарии владельца без super-admin и сохранения блокера владения для RU/KY/EN фраз. Итог: 7 наборов / 37 тестов PASS. Это ремонт тестовой инфраструктуры, **не семь живых продуктовых исправлений**.
- Web typecheck и проверка whitespace diff PASS. Полный общий набор/coverage в этом продолжении не запускался; прежние пробелы не объявлены устранёнными.
- Read-only SQL подтвердил отсутствие caller-проверки в старой девятиаргументной `create_internal_booking`; два связанных триггера проверяют график/филиал/пересечения, не полномочия. Эксплуатация не проверена; это всё ещё отдельный кодовый риск. Анонимная запись, подмена через service role, изменение grants и новые миграции не выполнялись.
- Прогресс и результаты: `apps/web/test-results/live-2026-10-11/progress.json`, `auth-command-baseline.json`, `web-baseline-retry.json`, `web-baseline-after.json`. Тестовые данные в рабочей базе не создавались.

Пользователь восстановил обычную вкладку `/dashboard`; живой интерфейс подтвердил владельца «Тестового бизнеса 2». F4/H2: в QuickDesk выбраны филиал 1, сотрудник, услуга 60 минут, 12 октября; показаны 33 слота и активная кнопка создания. Выход через обычный кабинет в соседней вкладке автоматически убрал форму и перевёл исходную вкладку на `/auth/sign-in?redirect=/dashboard` — **live PASS**. Бронь не создавалась. Это проверка защиты интерфейса, не доказательство авторизации старого RPC на уровне БД. Точные шаги: `stage-001-multitab-signout.json`; скриншот недоступен, сохранены фактические AX-наблюдения.

Следующий шаг: восстановить владельца обычным Google-входом и продолжить оставшиеся переходы бронирования; отдельный кодовый риск RPC остаётся открытым.

Ночной checkpoint 12 октября: H3/H5 адресная QuickDesk бронь `4e30608a` появилась подтверждённой в истории/календаре/чеке. До начала отсутствуют действия прихода/неявки. Отказ от отмены сохраняет запись; обычная отмена и повтор из устаревшего окна двух вкладок приводят к одной отменённой записи без активного слота. Это последовательный stale-сценарий, не доказательство истинной параллельности или дедупликации уведомлений. WB-134: английское имя кнопки закрытия русского окна live воспроизведено, исправлено в общем Dialog, повторено RU/KY/EN. 4 набора/22 теста, types и scoped product lint PASS; скриншоты недоступны. Бронь отменена, русский язык восстановлен. Дополнительные наблюдения: поиск не применяется до явного «Обновить», close-label уведомления всё ещё английский — не объявлены исправленными. Доказательства `stage-002-booking-cancel.json`.

Следующий checkpoint около04:15: WB-135 реактивность поиска по загруженной странице live воспроизведена и исправлена. Тот же короткий/полный ID даёт1строку сразу, отсутствующий текст0, очистка20без «Обновить». Чистый helper отделён от загрузки; сетевые фильтры/права не менялись. 3набора/11тестовPASS, targetedcoverage нового helper100%, typesPASS, scopedlint0ошибок/2старых hookwarnings. Это **не полнотекстовый поиск всей истории**: выборка20меньше page30, глобальная пагинация остаётся отдельным непроверенным пунктом. Сейчас2новых same-livefixes WB134/135, не53повторно проверенных всей-системы багов. Close-label уведомления остаётся очередной задачей; активных тестовых броней нет.

Checkpoint около04:30: WB136/137 live воспроизведены на отрицательном количестве визитов неактивной LIVE TEST акции. Сервер уже корректно отклонял-1, но UI показывал техническое `validation` и английское close-name. Добавлены field-метаданные существующей ошибки и локализованный mapping, общийToast переведён. Тот же отказ повторёнRU/KY/EN; исходныеN4/title/inactive/usage0прочитаны после reload, RUвосстановлен. 8наборов/38тестов и typesPASS. Targetedcoverage5модулей сначалаFAIL36.2%branches, дополнены контракты без снижения порогов, итогPASS. **ScopedlintнеPASS**: старый Toast set-state-in-effect подтверждёнвHEAD и5warning; не исправлялся без live-воспроизведения. Сейчас4новых same-livefixes WB134–137, не полныйPASSвеба. Новых сущностей/активных броней на этапе нет; неизменные сохранения могут обновить толькоtimestamp. `stage-004-promotion-errors.json`. Наблюдение для следующего этапа: дни недели филиала наKYостаютсяRU; ENпереведены.

## Автономный ночной прогон веба 2026-10-09 — завершён с пробелами

Это отдельный живой прогон, а не подтверждение исторических пользовательских чекбоксов. Мобильное приложение исключено. Детальные шаги и доказательства сохраняются локально в `apps/web/test-results/night-2026-10-09/progress.json` и отдельных stage-файлах.

Остановлен по сроку **09:00 по Бишкеку**. Автоматизация `kezek` переведена в `PAUSED`, приложение подтвердило статус; новых тестовых изменений после срока нет. Сервер оставлен работающим, открыт обычный профиль владельца и восстановленный график сотрудника. Это окончание ночного окна, **не завершение проверки всего веб-проекта**.

Актуальный checkpoint **08:51 по Бишкеку**: 51 подтверждённое живым повтором исправление `night-web-001..051` перенесено в общий реестр (`WB-083..133`). Последний консолидированный прогон затронутых ночных регрессий: **61 набор / 301 тест PASS**, проверка типов PASS. Это не весь проект и не релизный GO. Все17 известных ночных тестовых броней отменены (финальный read-only SQL); временные часы филиалов, дата-перевод сотрудника, дополнительная компетенция, имя/предпочтения профиля восстановлены. Исторические абзацы ниже — хронология, а не текущие блокеры. Подробная ночная матрица A–Q добавлена в каталог; его прежние исторические статусы не заменены ночным PASS.

### Сводка результатов этой ночи

- Публичная запись: обычный Google-вход сохраняет безопасное место возврата; выбранная услуга восстанавливается из URL; подтверждены и исправлены записи на дату временного филиала, авторизованный комплекс услуг, полный гостевой чек двух услуг/61 минуты. Гостевой успех виден в воронке. Последовательный конфликт двух устаревших форм отвергается без дубля, форма обновляет слоты.
- Сотрудник и финансы: открытие/сохранение/изменение/обновление/закрытие простой ручной смены, отдельное закрытие владельцем, сохранение ID/времени позиции. Отмеченная смена: клиентские 350 = услуга301 + материалы49; сотрудник181/бизнес169. Исправлены чтение финансового API, ошибочная денежная подпись/основание процентов и управление фильтрами при ошибке. Движок выплат не менялся; часовая гарантия и другие формулы не объявлены проверенными.
- Расписание: прочитан существующий план, опубликована адресная дата/филиал/перерыв, проверена реальная запись до границы перерыва, отсутствие и возвращение слотов, запреты выходного/отсутствия при существующей брони. Базовый филиал сотрудника не менялся. Полная матрица диапазонов/ночных интервалов/таймзон/нескольких сотрудников не пройдена.
- QuickDesk: без клиента, существующий клиент и новый контакт — создание/история/обычная отмена. Пустые поля и неверный телефон отклоняются. Новый контакт не создаёт аккаунт. Для существующего анонимизированного профиля верный client_id доказан, но представление имени требует отдельного решения о приватности; персональные данные не восстанавливались из auth metadata.
- Владелец/администратор: переключение двух бизнесов, фильтры аналитики, контакты/HTTPS-ошибка, каталог/карта, список и метки заявок, редактирование неактивной категории, сводка пользователей и глобальная воронка. Новый полный цикл принятия/отклонения заявок, разграничение менеджера и чужого владельца не пройдены.
- Пакеты/акции: тестовые настройки созданы/изменены/деактивированы, акция появилась публично и исчезла после выключения. Продажа/оплата/расходование/возврат пакета, погашение акции и положительный отзыв не тестировались.
- RU/KY/EN проверены точечно на найденных экранах; в конце исправлены объяснение гостевого пути, общая навигация записи, окно выбора способа и пояснения/ошибки формы гостя. Для окна выбора живьём прошли Tab/ShiftTab/Escape и возврат фокуса. Это не полная языковая/доступностная матрица.
- Гостевой прямой вход в /dashboard/bookings ошибочно показывал сетевой сбой вместо авторизации (`WB-133`). Исправлено распознавание типизированной отсутствующей сессии; тот же переход теперь приводит на обычный вход, сетевые/прочие400 ошибки не скрыты. Затем обычный Google-вход владельца восстановлен, открыт бизнес2. Неизвестный бизнес показывает понятный not-found/retry/catalog без раскрытия данных.

### Блокеры и непроверенное — не считать PASS

1. Указанный «клиентский» Google связан с профилем сотрудника. Нужны отдельные чистый клиент, менеджер, второй сотрудник и владелец другого бизнеса для полноценной проверки границ ролей/данных. Авторизованная запись владельца и гостевой путь их не заменяют.
2. WhatsApp API принял запрос OTP, но нового кода в доступном WhatsApp Web не обнаружено. Вход, webhook и доставка на устройство не подтверждены; API acceptance не равен доставке. Не брались коды из БД/старых сообщений и не обходилась проверка.
3. Email блокируется неоплаченным доменом. Яндекс callback на этом домене отложен пользователем. Telegram bot-login в локальной конфигурации не включён; безопасный __Host-cookie/webhook требует подходящей HTTPS-среды. Существующие связанный профиль и Telegram-уведомления не доказывают вход через бота.
4. Реальные узкие размеры390/768 не удалось установить доступным браузерным средством (фактический viewport1806×1651). Override сброшен. Адаптивный веб, Safari/Firefox, полная клавиатурная/скринридерная проверка не засчитаны.
5. Не завершены перенос/повтор/посещение/no-show, продажа и расходование пакетов, погашение акций, споры/коррекции часов, гарантии/почасовая оплата, рейтинги по завершённым визитам, фоновые задания и устойчивость на больших данных. Историческое пользовательское «прошло» не выдано за новый ночной повтор.
6. Общий ограниченный baseline остаётся красным:402/416 наборов PASS,14FAIL;1539/1552 тестов PASS,13FAIL. Одна mobile Telegram suite диагностически исключалась. Полный coverage ранее закончился исчерпанием памяти, а общий lint имеет прежние ошибки. Ночные61/301 и typecheck не делают весь репозиторий зелёным.
7. При обновлениях dev-сервер перезапускался из-за памяти; одна вкладка попала в policy-blocked data-ошибку подключения. Запрет не обходился; проверки продолжились на разрешённой вкладке приложения. Нагрузочная стабильность не подтверждена.

### Неподтверждённые кодовые риски

Это не live-баги и не исправленные результаты. Read-only SQL подтвердил: обе старые перегрузки create_internal_booking имеют SECURITY DEFINER и EXECUTE у anon/authenticated; прочитанные тела не содержат явного manager/auth guard. Триггеры записей существуют, но их полная защита tenant/caller и эксплуатация здесь не проверены. Это приоритетный аудит до релиза, не51-й «исправленный баг» и не повод слепо менять права. Поиск клиента использует auth metadata при анонимизированном профиле; гостевой путь требует отдельного аудита обработки результата confirm RPC. Нельзя возвращать скрытые персональные данные или объявлять эксплуатацию только по чтению кода. Факты и границы — final-cleanup-audit.json.

### Безопасное завершение и продолжение

Все известные тестовые брони отменены обычными действиями; последние шесть подтверждены read-only SQL. Аудит отмен и одна закрытая отмеченная смена сохранены, реального платежа не было. Тестовые пакет/акция/категория оставлены неактивными. Удаления основной базы/бизнесов/аккаунтов, сброса БД, повторного применения старых миграций не было. Новые адресные миграции зарегистрированы один раз. Ночью commit/push не выполнялись.

Следующий приоритет: отдельные роли/чужой бизнес → реальные390/768 и другой браузер → перенос/посещение/no-show → финансовые варианты и пакет/акция end-to-end → нормальный общий baseline и интеграции HTTPS/email. Для ночного прогона установлен жёсткий конец09:00; итоговое состояние автоматизации записывается в progress.json после остановки.

На 03:53 по Бишкеку проверены обычный Google-вход владельца/сотрудника, выбранный бизнес, чтение опубликованного графика, запрет сотруднику кабинетов владельца/админа, клиентская запись после входа и отмена, простой цикл ручной смены (открыть → сохранить → изменить → обновить → закрыть → повторно открыть/закрыть), сопоставление суммы у сотрудника и владельца. Это не полное покрытие соответствующих этапов.

Подтверждено и исправлено 12 проблем на проверенных путях. Финансовые записи больше не пересоздаются при закрытии сотрудником (`WB-083`); общая страница финансов владельца читает стандартный ответ API и снова показывает данные (`WB-084`). Остальные ночные находки пока подробно описаны в stage-файлах; их перенос в общий реестр и итоговый отчёт ещё предстоит.

Временный рабочий день сотрудника 09.10 и пятничные часы филиала восстановлены в исходное состояние; понедельник 09:00–18:00 не менялся. Отмеченная тестовая бронь отменена; закрытая отмеченная тестовая смена оставлена как история, реального платежа не было.

На 04:18 дополнительно пройден цикл QuickDesk без клиента: выбор параметров → создание → подтверждение → календарь/поиск истории → отмена → освобождение времени. Две созданные записи отменены, история сохранена. Исправлены блокирующая отсутствующая форма (`WB-085`), языковые подписи наблюдавшихся экранов (`WB-086`), невидимое подтверждение (`WB-087`), сохранение старого клиента после нового поиска (`WB-088`). На эти пути добавлено 16 регрессионных тестов. Создание QuickDesk с новым/существующим клиентом, hold, конкурентные сессии и живой временный перевод пока не пройдены.

На 04:31 исправлен месячный/годовой формат финансового фильтра и сохранение управляющих полей при ошибке (`WB-089`). Живьём проверены пустой филиал, месяц/год с отмеченной сменой, отклонение неверного года и восстановление через поле, возврат к исходному дню. Добавлено ещё 6 регрессий. Отдельно зафиксирована неоднозначность процентов в финансовой сводке: суммы включают разные основания; расчётный дефект движка пока не подтверждён, требуется проверка открытой/закрытой смены и ясная денежная разбивка.

Остаются: расширенные сценарии расписаний/броней и конкуренции, дополнительные режимы QuickDesk, отдельный путь закрытия владельцем, исправление часов и аудит, пакеты/акции/рейтинги, модерация, уведомления, настройки, публичная часть, адаптивные размеры и полная языковая матрица. Email ограничен неоплаченным доменом. Указанный клиентский Google-аккаунт фактически связан с профилем сотрудника: чистые клиентские ограничения ещё не проверены. Общий запуск покрытия завершился исчерпанием памяти Node; считать весь набор тестов пройденным нельзя. Точечные регрессии и проверка типов проходят.

На 04:42 исправлены три живьём подтверждённые проблемы аналитики: выбранный язык не применялся (`WB-090`), ошибка даты удаляла фильтры (`WB-091`), быстрый период включал лишний день (`WB-092`). Повторены исходные сценарии, переключение RU/KY/EN и восстановление периода; 11 новых регрессий, 15 тестов аналитики и проверка типов PASS. Расчёты агрегатов, их актуальность и соответствие исходным данным пока не подтверждены — нули не объявлены расчётным багом.

На 04:48 пройдены создание/редактирование/деактивация тестового типа пакета с проверкой сохранения после обновления и отрицательной скидкой 101%; проданные пакеты — только пустые фильтры, без продажи. Пакет деактивирован. В контактах бизнеса исправлен вывод машинного кода вместо причины отказа (`WB-093`), повторена ошибка HTTP-ссылки и успешное сохранение исходных контактов; 4 новых регрессии PASS. Продажа/списание пакетов и контакты филиала не подтверждены.

## Цель

Ночной checkpoint 05:04: дополнительно исправлены названия категорий каталога/карты (`WB-094`) и потеря выбранного филиала при переходе с карты (`WB-095`). Исходные живые сценарии повторены; гостевой каталог после обычного выхода тоже показывает названия. Новый доступ к публичным активным категориям применён адресной миграцией и зарегистрирован. Консолидированные 8 наборов / 28 тестов и проверка типов проходят. Общий ночной счёт: 23 исправленных наблюдавшихся проблемы (001–016, 018–024); 017 — ещё не классифицированное финансовое наблюдение. Это не полное покрытие областей проекта.

На 05:22 обычный Google-вход суперадмина успешен; история бизнес/ролевых заявок загружается. Исправлены технические метки/статусы модерации (`WB-096`), невозможность сохранения категории (`WB-097`), ложные нули сводки пользователей (`WB-098`). Повторены исходные сценарии; категория создана/отредактирована только как неактивная тестовая строка, существующие права/бизнесы не изменялись. Проверка новых решений модерации пока не пройдена. Повторный общий прогон с ограничением памяти завершился: 402 набора PASS, 14 FAIL, 1539 тестов PASS, 13 FAIL; один ранее падавший набор Telegram mobile исключён диагностически, поэтому это не весь набор и не зелёный результат. Диагноз падений/старых моков ещё предстоит. Отдельные новые регрессии и типы проходят. Попытка 390×844 через доступный браузерный API не изменила фактический размер: адаптивный прогон не подтверждён, временный override сброшен.

На 05:48 дополнительно пройдены отсутствие сотрудника (создание/обновление/публичное отсутствие слотов/двухшаговая отмена/возврат слотов), запрет отсутствия и публикации выходного при существующей брони. Отсутствие отменено, исходный понедельник 09:00–18:00 сохранён. Исправлены потеря Telegram-уведомлений при публичной записи и клиентской отмене (`WB-099`), дубли в одном чате при совмещении ролей (`WB-100`), грамматика нулевого счётчика кабинета (`WB-101`). Каждый исходный сценарий повторён в живом интерфейсе. Три дополнительные тестовые брони отменены, аудит сохранён. Точечные проверки: уведомления 31 + получатели 17 + счётчик кабинета 21 тест PASS, типы PASS. Общий счёт — 29 исправленных наблюдавшихся проблем, не весь проект; финансовое наблюдение 017, гостевые уведомления, конкурентные команды, адаптивный размер и ряд функциональных областей ещё не подтверждены. Доказательства — stage-файлы отсутствий, уведомлений и кабинета.

На 06:05 пройдены создание неактивной акции, изменение N/имени, активация → публичная карточка и деактивация → скрытие. Исправлены пустой список сохранённых акций (`WB-102`) и переключение филиала вместо акции при нажатии подписи (`WB-103`); ошибочное состояние филиала не сохранялось. Тестовая акция оставлена неактивной. Две вкладки выбрали 09:00; первая создала бронь, вторая была отклонена без дубля, но техническим сообщением и без обновления формы. Это исправлено (`WB-104`), тот же сценарий повторён: 409, человеческий текст, закрытое устаревшее подтверждение, занятый час удалён. SQL подтвердил одну строку, затем ноль после отмены. Обе новые брони отменены. Добавочные регрессии акций и конфликта проходят, типы проходят; общий счёт 32 наблюдавшихся исправленных проблемы. Это последовательный конфликт устаревшей формы, не доказательство полной конкурентной/идемпотентной матрицы.

На 06:12 проверены сохранение/обновление имени профиля и переключателя уведомлений Telegram OFF → обновление → ON → обновление. Исходное имя и все предпочтения восстановлены. Запрос удаления аккаунта владельца объясняет блокеры и недоступен; сам цикл удаления не запускался. В деталях смены устранено смешение языков в заголовке и списке клиентов (`WB-105`, `WB-106`), исходные сценарии повторены RU/KY/EN. CSV выгружен: одна отмеченная строка 301/49/350 с прежним временем заполнения. Переоткрытие закрытой смены в выходной отвергнуто 400 и не изменило её итоговые суммы. Два набора / 10 регрессий и типы PASS; расчётные варианты, гарантия/часовые коррекции и сравнение открытой/закрытой смены ещё не подтверждены. Общий счёт — 34 исправленные наблюдавшиеся проблемы, не полное покрытие проекта.

На 06:29 отдельный путь закрытия владельцем больше не пересоздаёт позиции (`WB-107`): живой повтор и SQL сохраняют ID и время строки. При первом воспроизведении старый код уже заменил прежнюю позицию — это явно зафиксировано, история не подделывалась. Общая сверка сохранённого снимка покрыта регрессиями и 100% scoped coverage; временный пятничный график полностью восстановлен. Финансовое наблюдение 017 оказалось дефектом представления (`WB-108`): 350 общей суммы с разбивкой 301/49 и долями 51.7%/48.3%, проверено RU/KY/EN и нулевой филиал. Движок выплат не изменялся. Общий счёт — 36 исправленных наблюдавшихся проблем; весь проект не объявлен проверенным.

Вручную пройти Kezek как реальный пользователь во всех продуктовых ролях и состояниях:

1. гость;
2. клиент;
3. владелец или менеджер бизнеса;
4. сотрудник;

С14октября общий WEB scope включает супер-админку как самостоятельный защищённый контур: страницы, прямые API, модерацию и диагностику. Действия выдачи прав, необратимого удаления и других чувствительных изменений не разрешаются автоматически обычным прогоном; для них нужны адресные безопасные fixtures и подтверждение конкретного действия. Прежняя вспомогательная роль администратора описывает исторический scope, не текущую цель.

План построен по зависимостям. Сначала создаются аккаунты и тестовый бизнес, затем филиал, услуги, сотрудники и расписание. После этого выполняются клиентская запись, операционная работа, финансы, уведомления и негативные сценарии.

Полный технический каталог областей: [WEB_LIVE_TESTING_AREAS_CATALOG.md](./WEB_LIVE_TESTING_AREAS_CATALOG.md).

## Правила работы

- `[ ]` — не проверено.
- `[x]` — пользователь либо Codex прошёл живой сценарий и сохранил ожидаемый результат с доказательствами, сборкой и границами. Автотест сам по себе не закрывает live-сценарий.
- `[!]` — сценарий заблокирован найденным багом. В Markdown используем текстовый маркер рядом с пунктом.
- Не отмечаем этап целиком, пока не выполнены все его обязательные пункты.
- После сообщения пользователя «готово», «прошло» или описания бага Codex:
  1. обновляет этот документ;
  2. фиксирует результат или баг;
  3. указывает следующий конкретный сценарий;
  4. при необходимости просит войти под нужным аккаунтом.
- Все создаваемые данные называем с префиксом `LIVE TEST`, чтобы их было легко найти и удалить.
- Не используем реальные данные клиентов, сотрудников, телефоны или деньги.
- Удаление аккаунтов, бизнеса и других крупных данных проверяем только на специально созданных тестовых сущностях.

## Стоп-условия

Останавливаем текущий сценарий и сначала исправляем баг, если:

- возникает красный экран, бесконечная загрузка или redirect loop;
- действие создаёт дубль;
- данные одного бизнеса попадают в другой;
- пользователь видит чужие данные или действие без нужной роли;
- бронь подтверждается на уже занятое время;
- финансовые суммы различаются между кабинетами;
- опасное действие выполняется без понятного подтверждения;
- интерфейс сообщает об успехе, хотя данные не сохранились.

## Матрица тестовых аккаунтов

Заполняем только безопасные метки, без паролей и токенов.

| Код | Роль | Для чего нужен | Готов |
| --- | --- | --- | --- |
| `ADMIN` | вспомогательный супер-администратор | только подготовка условий для тестов других ролей | [x] |
| `OWNER` | владелец основного тестового бизнеса | настройка бизнеса и операционная работа | [x] |
| `MANAGER` | менеджер без прав владельца | проверка ограниченных бизнес-прав | [ ] |
| `STAFF-1` | основной сотрудник | расписание, записи, смены и финансы | [ ] |
| `STAFF-2` | второй сотрудник | конфликты, перенос и увольнение | [ ] |
| `CLIENT-1` | основной клиент | запись, отмена, профиль, отзывы и пакеты | [ ] |
| `CLIENT-2` | второй клиент | конкуренция за слот и изоляция данных | [ ] |
| `GUEST` | отдельное инкогнито-окно | публичный путь и гостевая запись | [ ] |

## Матрица тестовых данных

| Сущность | Рекомендуемое имя | Создана |
| --- | --- | --- |
| Основной бизнес | `LIVE TEST Business A` | [x] |
| Второй бизнес | `LIVE TEST Business B` | [ ] |
| Основной филиал | `LIVE TEST Branch A1` | [x] |
| Второй филиал | `LIVE TEST Branch A2` | [ ] |
| Основная услуга | `LIVE TEST Service 30` | [ ] |
| Длинная услуга | длинное название для проверки вёрстки | [ ] |
| Акция | `LIVE TEST Promo` | [ ] |
| Пакет визитов | `LIVE TEST Package` | [ ] |
| Основная запись | будущая дата минимум через сутки | [ ] |

## Карта этапов

| Этап | Область | Нужная роль | Статус |
| --- | --- | --- | --- |
| `00` | фиксация среды и базовая загрузка | гость | не начат |
| `01` | публичная часть и карта | гость | не начат |
| `02` | вход, провайдеры, профиль и сессия | клиент | в процессе |
| `03` | заявка на бизнес и модерация | клиент + админ | пройден основной путь |
| `04` | настройка бизнеса | владелец | в процессе |
| `05` | сотрудники, менеджеры и права | владелец + сотрудник | не начат |
| `06` | стандартная запись клиента | клиент | не начат |
| `07` | гостевая запись и конфликт слотов | гость + второй клиент | не начат |
| `08` | кабинет клиента | клиент | не начат |
| `09` | QuickDesk и операции владельца | владелец | не начат |
| `10` | кабинет сотрудника и смены | сотрудник | не начат |
| `11` | финансы и аудит | владелец + сотрудник | не начат |
| `12` | акции, пакеты и рейтинги | владелец + клиент | не начат |
| `13` | уведомления и интеграции | клиент + владелец | не начат |
| `14` | роли, несколько бизнесов и guards | все роли | не начат |
| `15` | вспомогательные действия админа | админ | выполняются по необходимости |
| `16` | ошибки, повторные действия и безопасность | разные роли | не начат |
| `17` | адаптивность, языки и accessibility | разные роли | не начат |
| `18` | production и release smoke | разные роли | не начат |
| `19` | очистка тестовых данных | админ | не начат |

---

## Этап 00. Среда и базовая загрузка

Роль: `GUEST`
Цель: убедиться, что тестируем правильную сборку и она стабильно запускается.

- [ ] Зафиксировать дату, commit и адрес окружения в «Журнале прогонов».
- [ ] Открыть напрямую `/`, `/auth/sign-in`, `/map`, `/privacy`, `/terms`, `/data-deletion`.
- [ ] Перезагрузить каждый URL через hard refresh.
- [ ] Проверить Back и Forward между страницами.
- [ ] Убедиться, что нет пустого экрана, hydration error, redirect loop или бесконечного spinner.
- [ ] Проверить понятный `404` на несуществующем URL.
- [ ] Проверить, что production-страница не загружает ресурсы с `localhost`.
- [ ] Проверить, что локальная страница не перебрасывает на production без явной причины.
- [ ] Открыть DevTools и убедиться, что нет новых ошибок console и упавших основных запросов.

Готово, когда все публичные входные точки стабильно открываются напрямую.

## Этап 01. Публичная часть, поиск и карта

Роль: `GUEST`

### Главная

- [ ] Проверить понятность первого экрана, поиска и основных CTA.
- [ ] Найти бизнес по полному названию.
- [ ] Найти бизнес по части названия.
- [ ] Найти по услуге, категории, адресу или району.
- [ ] Проверить поиск без результатов и очистку запроса.
- [ ] Проверить фильтр категории и возврат к «Все».
- [ ] Убедиться, что карточки не показывают внутренние данные.

### Публичная карточка бизнеса

- [ ] Открыть `/b/[slug]` из поиска и прямым URL.
- [ ] Проверить название, категорию, описание, контакты и доступные филиалы.
- [ ] Проверить рабочие `tel:`, карты и внешние ссылки.
- [ ] Проверить состояние без филиалов, услуг, рейтинга, фото или контактов.
- [ ] Проверить, что скрытый или неодобренный бизнес не становится публичным.
- [ ] Проверить CTA записи и страницу акций.

### Карта

- [ ] Открыть `/map` на desktop, `768 px` и `390 px`.
- [ ] Сравнить филиалы в списке и маркеры на карте.
- [ ] Выбрать категорию.
- [ ] Нажать «Ближайший ко мне»: разрешить и запретить геолокацию.
- [ ] Открыть карточку филиала и перейти к записи.
- [ ] Проверить zoom, scroll и отсутствие наложения footer/header.
- [ ] Проверить понятное восстановление после временной ошибки карты.

## Этап 02. Вход, провайдеры, профиль и сессия

Роли: `CLIENT-1`, при необходимости новые временные аккаунты.

### Вход

- [x] Выполнить успешный вход хотя бы одним способом.
- [ ] Проверить Google: новый вход, повторный вход, отмена провайдером.
- [ ] Проверить Яндекс: новый вход, повторный вход, отмена провайдером.
- [ ] Для local-прогона добавить в настройках Yandex OAuth callback `http://localhost:3000/auth/callback-yandex`; затем проверить, что OAuth возвращает именно на localhost.
- [ ] Проверить Telegram: текущий аккаунт и «Подключить другой аккаунт».
- [ ] Проверить WhatsApp: корректный OTP, неверный OTP, повторная отправка и cooldown.
- [ ] Проверить, что подключённый WhatsApp входит в существующий аккаунт, а не создаёт дубль.
- [ ] Проверить, что OAuth на localhost возвращается на localhost.
- [ ] Проверить `redirect` после входа на исходную защищённую страницу.

### Связывание способов входа

- [ ] Подключить Google и Яндекс к одному аккаунту.
- [ ] Войти каждым провайдером и убедиться, что открывается один профиль.
- [ ] Проверить отображение подтверждённых email каждого провайдера.
- [ ] Выбрать один email, несколько email или отключить email-уведомления.
- [ ] Отвязать один провайдер, сохранив минимум один рабочий способ входа.
- [ ] Попытаться отвязать последний способ входа — система должна защитить аккаунт.
- [ ] Попытаться связать провайдера, уже принадлежащего другому аккаунту.

### Профиль

- [ ] Изменить имя и телефон, сохранить и перезагрузить страницу.
- [ ] Проверить валидацию пустого имени и некорректного телефона.
- [ ] Убедиться, что вход через Google, Яндекс или Telegram не перезаписывает вручную заданное имя.
- [ ] Проверить настройки каналов уведомлений.
- [ ] Проверить понятность удаления аккаунта без выполнения финального удаления основного аккаунта.

### Сессия

- [ ] Выйти и проверить недоступность защищённых страниц.
- [ ] Войти снова и проверить восстановление исходного маршрута.
- [ ] Открыть аккаунт в двух вкладках, выйти в одной и обновить вторую.
- [ ] Оставить сессию до обновления access token и затем перезагрузить страницу.
- [ ] Повторно проверить исправленный кейс: устаревший refresh token не показывает красный экран.

## Этап 03. Заявка на бизнес и модерация

Роли: `CLIENT-1` → `ADMIN` → `OWNER`.

### Уже пройдено

- [x] Авторизоваться перед отправкой заявки.
- [x] Отправить заявку на создание бизнеса.
- [x] Увидеть заявку в `/admin/business-applications`.
- [x] Одобрить заявку и создать бизнес.
- [x] Получить доступ владельца.

### Обязательная регрессия

- [ ] Проверить автозаполнение имени, телефона и email из аккаунта.
- [ ] Проверить готовую категорию и предложение новой категории.
- [ ] Проверить необязательные ссылки Instagram, 2GIS, Google Maps и Яндекс Карт.
- [ ] Проверить обязательные поля и понятные ошибки.
- [ ] Дважды нажать отправку — должна появиться одна заявка.
- [ ] Повторить название существующего бизнеса — заявка должна быть заблокирована или явно направлена на подтверждение владения.
- [ ] Повторить заявку, пока первая ожидает решения.
- [ ] Проверить отклонение без блокировки.
- [ ] Проверить отклонение с временной блокировкой и окончание блокировки.
- [ ] Убедиться, что отклонённая заявка не создаёт бизнес и роли.
- [ ] Убедиться, что одобрение атомарно создаёт бизнес и выдаёт доступ правильному аккаунту.

## Этап 04. Полная настройка бизнеса

Роль: `OWNER`
Текущая точка прогона: создание первой услуги.

### 04.1 Контекст и настройки бизнеса

- [ ] Открыть `/dashboard` напрямую и через переключатель роли.
- [ ] Проверить правильное название и метрики текущего бизнеса.
- [ ] Открыть настройки, изменить безопасное поле и сохранить.
- [ ] Проверить контакты бизнеса и публичное наследование контактов филиалом.
- [ ] Проверить ошибки обязательных и некорректных значений.

### 04.2 Филиалы

- [x] Создать основной филиал.
- [ ] Открыть его напрямую после перезагрузки.
- [ ] Изменить название, адрес, контакты и положение на карте.
- [ ] Включить и выключить наследование контактов бизнеса.
- [ ] Настроить график филиала, выходной и перерыв.
- [ ] Создать второй филиал и проверить лимит филиалов.
- [ ] Проверить отмену редактирования.
- [ ] Попытаться удалить филиал с зависимыми данными и проверить понятное предупреждение.

### 04.3 Услуги — следующий ручной сценарий

- [x] Открыть `/dashboard/services`.
- [x] Создать `LIVE TEST Service 30` с длительностью 30 минут и корректной ценой.
- [x] Привязать услугу к основному филиалу.
- [x] Проверить услугу в списке владельца, включая длинное название, на desktop, `768 px` и `390 px`.
- [x] Переключить `RU`, `KG`, `EN` и убедиться, что название услуги в кабинете владельца берётся из соответствующего языкового поля, а не всегда из русского.
- [ ] Проверить услугу и её выбранный перевод в публичной записи после создания сотрудника и настройки его графика.
- [x] Изменить название, длительность и цену; сохранить и проверить после обновления страницы.
- [x] Проверить пустое название, отрицательную цену и некорректную длительность; форма показывает локализованные ошибки и не сохраняет данные.
- [x] Создать услугу с длинным названием и проверить layout.
- [x] Создать одинаковую услугу во втором филиале и проверить группировку/разделение.
- [x] Вернуться к списку услуг без сохранения и убедиться, что несохранённые изменения не применились.
- [x] Удалить услугу без записей.
- [ ] Попытаться удалить услугу с существующей записью и проверить понятную защиту.

### 04.4 Графики и слоты

- [ ] Настроить рабочие часы филиала.
- [ ] Настроить график сотрудника после этапа 05.
- [ ] Проверить выходной, перерыв, смену через полночь и временно закрытый день.
- [ ] Убедиться, что доступные слоты учитывают услугу, филиал, сотрудника и занятые записи.

## Этап 05. Сотрудники, менеджеры и права

Роли: `OWNER`, затем `STAFF-1`, `STAFF-2`, `MANAGER`.

### Создание и приглашение

- [ ] Войти отдельным тестовым аккаунтом `STAFF-1` и отправить публичную заявку стать сотрудником выбранного бизнеса.
- [ ] Войти как `OWNER`, открыть заявки доступа и одобрить заявку `STAFF-1`.
- [ ] Вернуться под `STAFF-1` и убедиться, что кабинет сотрудника и доступ к бизнесу появились без ручного создания записи владельцем.
- [ ] Проверить, что повторное добавление не создаёт дубль.
- [ ] Добавить `STAFF-2` тем же публичным способом, если доступно.
- [ ] Назначить филиал, услуги, должность, цвет и базовые финансовые параметры.
- [ ] Загрузить и удалить avatar.

### Расписание

- [ ] Настроить обычную рабочую неделю `STAFF-1`.
- [ ] Добавить выходной, перерыв и нестандартный день.
- [ ] Проверить экран рассчитанных слотов.
- [ ] Убедиться, что сотрудник не получает слоты вне филиала или графика.

### Жизненный цикл

- [ ] Изменить сотрудника и проверить сохранение.
- [ ] Перевести `STAFF-2` в другой филиал.
- [ ] Уволить сотрудника и проверить недоступность staff-кабинета.
- [ ] Восстановить сотрудника.
- [ ] Удалить специально созданного сотрудника без исторических данных.

### Менеджер и участники

- [ ] Добавить `MANAGER` через members/permissions.
- [ ] Проверить доступ менеджера к разрешённым разделам.
- [ ] Проверить отсутствие owner-only и super-admin действий.
- [ ] Изменить права и проверить эффект после обновления страницы.
- [ ] Отозвать доступ и проверить немедленную защиту.

## Этап 06. Стандартная запись клиента

Роль: войти как `CLIENT-1`.

- [ ] Найти тестовый бизнес с главной страницы.
- [ ] Начать запись из публичной карточки.
- [ ] Проверить порядок шагов: филиал → день → сотрудник → услуга → время.
- [ ] Выбрать данные и перейти вперёд.
- [ ] Вернуться кликом на каждый предыдущий шаг.
- [ ] Проверить очистку только зависимых последующих значений.
- [ ] Выбрать несколько услуг, если сценарий поддерживается.
- [ ] Проверить общую длительность и итоговую цену.
- [ ] Выбрать свободное время и подтвердить запись.
- [ ] Дважды нажать подтверждение — должна создаться одна запись.
- [ ] Проверить понятный success-state и номер/детали записи.
- [ ] Убедиться, что запись появилась в кабинете клиента, владельца и сотрудника.

## Этап 07. Гостевая запись и конкуренция за слот

Роли: `GUEST` в инкогнито + `CLIENT-2` в обычном или другом браузере.

### Гостевая запись

- [ ] Начать запись без авторизации.
- [ ] Проверить имя, телефон и согласия гостя.
- [ ] Проверить неверный и пустой телефон.
- [ ] Проверить быструю временную бронь/hold и её истечение.
- [ ] Завершить гостевую запись.
- [ ] Проверить, что гостю не раскрываются данные других клиентов.

### Конкуренция

- [ ] Открыть один слот одновременно как `GUEST` и `CLIENT-2`.
- [ ] Подтвердить запись первым пользователем.
- [ ] Подтвердить тем же временем вторым пользователем.
- [ ] Второй пользователь должен получить понятный конфликт и свежие слоты.
- [ ] Повторить после Back, refresh и задержки перед подтверждением.

## Этап 08. Кабинет клиента

Роль: `CLIENT-1`.

- [ ] Проверить предстоящие и прошедшие записи.
- [ ] Открыть детали записи прямым URL.
- [ ] Проверить данные бизнеса, филиала, сотрудника, услуг, цены и статуса.
- [ ] Отменить будущую запись.
- [ ] Повторить отмену и проверить идемпотентность.
- [ ] Проверить невозможность отменить чужую или уже завершённую запись.
- [ ] Повторить запись из истории.
- [ ] Проверить редактирование профиля и каналов уведомлений.
- [ ] Проверить список активных, использованных и истёкших пакетов.
- [ ] Оставить отзыв после допустимого визита.
- [ ] Изменить отзыв, если это разрешено.
- [ ] Убедиться, что отзыв до завершённого визита недоступен.

## Этап 09. QuickDesk и операции владельца

Роль: `OWNER`.

- [ ] Открыть список и календарь записей.
- [ ] Фильтровать по филиалу, сотруднику, дате и статусу.
- [ ] Найти запись `CLIENT-1`.
- [ ] Открыть детали прямым URL.
- [ ] Создать ручную запись для существующего клиента.
- [ ] Создать запись для нового клиента.
- [ ] Создать quick hold и затем подтвердить его.
- [ ] Изменить время, сотрудника или услугу записи.
- [ ] Проверить конфликт при переносе на занятое время.
- [ ] Изменить допустимые статусы записи.
- [ ] Отметить посещение и неявку.
- [ ] Проверить отмену и восстановившуюся доступность слота.
- [ ] Проверить двойной клик, refresh во время сохранения и повтор запроса.

## Этап 10. Кабинет сотрудника и смены

Роль: войти как `STAFF-1`.

### Кабинет

- [ ] Открыть `/staff`, `/staff/bookings`, `/staff/schedule`, `/staff/finance`.
- [ ] Убедиться, что видны только свои филиал, график, записи и финансы.
- [ ] Открыть сегодняшние и будущие записи.
- [ ] Проверить отсутствие owner/admin действий.

### Смена

- [ ] Открыть смену.
- [ ] Повторно нажать «Открыть».
- [ ] Добавить или изменить допустимые позиции/услуги смены.
- [ ] Проверить retry после временной ошибки сети.
- [ ] Закрыть смену.
- [ ] Повторно нажать «Закрыть».
- [ ] Проверить смену без записей, с записью, неявкой и отменой.
- [ ] Попытаться открыть вторую активную смену.

## Этап 11. Финансы и аудит

Роли: `OWNER`, затем `STAFF-1`.

- [ ] Зафиксировать ожидаемую стоимость услуг и правила оплаты сотрудника.
- [ ] Закрыть простую смену и вручную посчитать ожидаемую сумму.
- [ ] Сравнить сумму в кабинете сотрудника, владельца и общей аналитике.
- [ ] Проверить разные payment modes, если доступны.
- [ ] Проверить процент, фиксированную выплату, гарантию и доплату.
- [ ] Проверить отмену, неявку, бесплатную и скидочную услугу.
- [ ] Исправить отработанные часы владельцем.
- [ ] Убедиться, что перерасчёт произошёл один раз.
- [ ] Проверить audit log: кто, когда и что изменил.
- [ ] Проверить фильтры по периоду, сотруднику и филиалу.
- [ ] Проверить пустое состояние и большой период.
- [ ] Убедиться, что сотрудник не видит финансы другого сотрудника.

## Этап 12. Акции, пакеты визитов и рейтинги

Роли: `OWNER` → `CLIENT-1`.

### Акции

- [ ] Создать процентную или фиксированную акцию.
- [ ] Ограничить филиалом, услугой, датой или временем.
- [ ] Проверить публичную страницу акции.
- [ ] Проверить активную, будущую и истёкшую акцию.
- [ ] Проверить пересечение нескольких акций и ожидаемый приоритет.
- [ ] Создать запись с акцией и сравнить цену на всех экранах.

### Пакеты визитов

- [ ] Создать план пакета.
- [ ] Продать пакет `CLIENT-1`.
- [ ] Проверить пакет в кабинете клиента.
- [ ] Использовать визит при завершении подходящей записи.
- [ ] Проверить остаток, повторное списание, отмену и истечение.
- [ ] Проверить неподходящую услугу/филиал.

### Рейтинги

- [ ] Завершить визит и оставить отзыв.
- [ ] Проверить рейтинг сотрудника, филиала и бизнеса.
- [ ] Проверить отсутствие рейтинга и недостаточность данных.
- [ ] Проверить естественный пересчёт рейтинга после нового допустимого отзыва.
- [ ] Убедиться, что новый результат одинаково отображается на публичной карточке и в кабинете бизнеса.

## Этап 13. Уведомления и интеграции

Роли: `CLIENT-1`, `OWNER`.

### Клиентские уведомления

- [ ] Включить только email и создать запись.
- [ ] Включить только WhatsApp и создать/изменить запись.
- [ ] Включить только Telegram и отменить запись.
- [ ] Включить несколько email и проверить доставку каждому выбранному адресу.
- [ ] Отключить канал и убедиться, что он ничего не получает.
- [ ] Сверить бизнес, филиал, сотрудника, услугу, дату, время и статус.
- [ ] Проверить отсутствие дублей уведомлений.

### Интеграции

- [ ] Подключить и отключить Telegram.
- [ ] Переключить на другой Telegram-аккаунт.
- [ ] Подключить и отключить WhatsApp.
- [ ] Проверить понятные статусы интеграций в dashboard.
- [ ] Проверить безопасную ошибку временно недоступного провайдера и retry.
- [ ] Проверить, что webhook-дубль не создаёт повторное действие.
- [ ] Вместе с Codex проверить результаты cron: закрытие смен, рейтинг, retention, analytics и health alerts.

## Этап 14. Роли, несколько бизнесов и guards

Роли: все подготовленные аккаунты.

### Переключение ролей

- [ ] Проверить каждый доступный кабинет из header.
- [ ] Убедиться, что текущая роль визуально понятна.
- [ ] Запомнить выбранный кабинет, обновить страницу и войти повторно.
- [ ] Проверить первый вход пользователя с несколькими ролями.
- [ ] Проверить прямой URL каждого чужого кабинета.
- [ ] Убедиться, что пользователь без бизнес-доступа не получает owner-кабинет через прямой URL.

### Несколько бизнесов

- [ ] Создать или получить доступ к `LIVE TEST Business B`.
- [ ] Создать отличимые филиал, услугу и сотрудника во втором бизнесе.
- [ ] Переключить бизнес в dashboard.
- [ ] Проверить overlay загрузки и защиту от повторных кликов.
- [ ] Сравнить услуги, сотрудников, записи, финансы и аналитику.
- [ ] Перезагрузить страницу и проверить сохранение контекста.
- [ ] Открыть старый URL после переключения.
- [ ] Отозвать доступ к текущему бизнесу и проверить безопасный fallback.

## Этап 15. Вспомогательные действия супер-админа

Роль: `ADMIN`. Этот этап не является самостоятельным прогоном админки. Выполняем только тот пункт, который создаёт условие для проверки другой роли.

- [x] Одобрить исходную заявку и выдать роль владельца для этапов `04-14`.
- [ ] Одобрить предложенную категорию, только если она нужна для проверки формы заявки и публичного поиска.
- [ ] Одобрить или отклонить заявку сотрудника, только если тестируется публичное присоединение к команде.
- [ ] Подготовить второй тестовый бизнес или дополнительный доступ, только если это нельзя безопасно сделать продуктовым потоком.
- [ ] Снять временную блокировку тестового аккаунта или заявки, только если иначе нельзя продолжить негативный сценарий.
- [ ] Проверить в базе или админском экране фактический результат операции другой роли, только когда пользовательский UI не даёт достаточного подтверждения.
- [ ] В конце удалить тестовые сущности, которые нельзя удалить из кабинетов владельца, сотрудника или клиента.

Не входят в текущий прогон:

- полный UI/UX аудит `/admin`;
- управление супер-админами;
- создание и security-действия над пользователями;
- ручной CRUD ролей и системных категорий вне нужд пользовательского сценария;
- admin analytics, monitoring, health, performance, rating debug и служебные экраны;
- проверка всех admin API и внутренних диагностических инструментов.

## Этап 16. Ошибки, повторные действия и безопасность

Роли: разные.

- [ ] Отключить сеть перед сохранением формы, затем вернуть и повторить.
- [ ] Обновить страницу во время загрузки и сохранения.
- [ ] Нажать основную кнопку несколько раз.
- [ ] Открыть одну сущность в двух вкладках и изменить обеими.
- [ ] Проверить устаревшие данные и понятный конфликт.
- [ ] Проверить длинные строки, emoji, пробелы, HTML и спецсимволы в безопасных полях.
- [ ] Проверить большие и отрицательные числа.
- [ ] Проверить прямой доступ к чужим ID бизнеса, филиала, записи и пользователя.
- [ ] Убедиться, что UI и URL не раскрывают токены, ключи и внутренние stack traces.
- [ ] Проверить CSRF/подтверждение для опасных действий на уровне пользовательского поведения.
- [ ] Проверить rate limit OTP, заявок и повторных действий.
- [ ] Проверить privacy, terms, data deletion и выход из аккаунта.
- [ ] Проверить browser Back после logout — защищённые данные не должны возвращаться.

## Этап 17. Адаптивность, языки и доступность

Этот этап повторяет критические экраны, а не заменяет функциональные этапы.

### Viewports

- [ ] `390 x 844` — мобильный.
- [ ] `768 x 961` — планшет.
- [ ] `1280 x 720` — обычный desktop.
- [ ] `1716 x 961` — широкий desktop.
- [ ] Проверить отсутствие горизонтального scroll, обрезки и наложений.
- [ ] Проверить touch targets, sticky header/footer и мобильные меню.

### Языки

- [ ] Пройти ключевые экраны на `RU`.
- [ ] Повторить на `KG`.
- [ ] Повторить на `EN`.
- [ ] Проверить header, footer, role/business switcher, формы, ошибки, success/empty/loading states.
- [ ] Проверить даты, время, числа, цены и длинные переводы.
- [ ] Отделять пользовательские данные от непереведённого интерфейса.

### Keyboard и screen reader smoke

- [ ] Пройти Tab по основным действиям каждого ключевого экрана.
- [ ] Проверить видимый focus и логичный порядок.
- [ ] Открыть/закрыть меню и dialog клавиатурой.
- [ ] Проверить Escape, Enter и Space.
- [ ] Проверить доступные названия language switcher и pressed-state.
- [ ] Проверить labels полей, errors, alerts и status updates.
- [ ] Убедиться, что смысл не передаётся только цветом.

### Браузеры

- [ ] Chrome desktop.
- [ ] Edge desktop.
- [ ] Android Chrome или responsive smoke.
- [ ] Дополнительный браузер для конкуренции сессий и слотов.

## Этап 18. Production и release smoke

Запускается после commit, push, миграций и успешного deploy.

- [ ] Проверить статус deployment и commit.
- [ ] Открыть production `/`, `/map`, `/auth/sign-in`, публичный бизнес.
- [ ] Проверить вход каждым реально поддерживаемым провайдером.
- [ ] Выполнить одну безопасную полную запись.
- [ ] Увидеть запись клиентом, владельцем и сотрудником.
- [ ] Отменить или завершить тестовую запись.
- [ ] Проверить уведомления.
- [ ] Проверить dashboard владельца, кабинет сотрудника и кабинет клиента.
- [ ] Проверить console и основные network-запросы.
- [ ] Проверить desktop и mobile smoke.
- [ ] Убедиться, что миграции применены и schema cache актуален.
- [ ] Зафиксировать `GO`, `GO WITH GAPS` или `NO-GO`.

## Этап 19. Очистка тестовых данных

Роль: `ADMIN`.

- [ ] Составить список всех сущностей с префиксом `LIVE TEST`.
- [ ] Сохранить нужные screenshots и баг-доказательства.
- [ ] Удалить или архивировать тестовые записи безопасным способом.
- [ ] Удалить промо и пакеты.
- [ ] Удалить временных сотрудников, менеджера и клиентов, если они больше не нужны.
- [ ] Удалить второй тестовый бизнес.
- [ ] Решить, оставить ли основной тестовый бизнес для регрессии.
- [ ] Убедиться, что системные справочники и супер-админ не затронуты.
- [ ] Повторить короткий public smoke после очистки.

---

## Универсальная проверка каждого экрана

На каждом новом экране отмечаем минимум:

- [ ] понятен основной сценарий и главное действие;
- [ ] есть корректные loading, empty, success и error states;
- [ ] повторный клик не создаёт дубль;
- [ ] refresh, Back и Forward не ломают данные;
- [ ] прямой URL работает или безопасно защищён;
- [ ] нет горизонтального scroll на `390 px` и `768 px`;
- [ ] `KG`, `RU`, `EN` переводят весь интерфейс;
- [ ] header, меню, dialog и footer не перекрывают контент;
- [ ] keyboard focus виден;
- [ ] в console нет новых ошибок;
- [ ] сообщение об успехе соответствует реально сохранённым данным;
- [ ] опасное действие имеет понятное подтверждение.

## Найденные баги текущего прогона

| № | Этап | Сценарий | Фактический результат | Статус | Повторная проверка |
| --- | --- | --- | --- | --- | --- |
| 1 | `02` | Загрузка `/` со старой локальной сессией | `Invalid Refresh Token: Refresh Token Not Found` открывал красный экран | исправлено локально | ожидает ручного подтверждения |
| 2 | `04.3` | Список услуг при ширине `1024 px`, языки `KG/RU/EN` | Таблица сжимала название, цену и действия; удаление и название услуги оставались русскими | исправлено локально | проверить карточки на `1024/768/390 px`, диалог удаления и названия услуг на трёх языках |
| 3 | `04.3` | Валидация формы услуги на `EN` | Нативные сообщения браузера оставались русскими; сервер не всегда блокировал отрицательную цену | исправлено локально | проверить ошибки формы на `KG/RU/EN` и отрицательную цену |
| 4 | `02` | Переход на `/auth/sign-in` с главной страницы | Во время загрузки показывался технический текст «Загружаем…» без структуры и пояснения | исправлено локально | проверить короткий переход на `KG/RU/EN` |
| 3 | `04.3` | Действия услуги в широкой таблице | Текст ссылки `Edit` не был выровнен по центру относительно кнопки `Delete` | исправлено локально | обновить страницу и визуально проверить строку действий |

## Журнал прогонов

### 2026-10-13: дневное продолжение до 19:00 Бишкек

17:22stage045: Ownerbusiness1context rejectsstaff2card/schedule, nofields disclosed butrawNEXTHTTP404→WB170. SharedboundarypublicNextunstable_rethrow preservesframeworknotFound; sameURLs friendly404, ordinaryerrorfallback tests preserved. Restorebusiness2/RU viaordinarypicker: employee/review3/graph19Oct09–18/old2cancelledabsences correct.3suites16PASS/types94311/scopedlint0errors0warnings;60%coveragegatePASS (21/22,4/5,10/15), APIversionrisknoted.15same-livecurrentrunfixes/day11, no entitychange. Fullforeignowner/manager/API/RPC and404languages untested. Stage046financehourly/guarantee orotheruntestedflows next.

17:11stage044: Negativeabsence actualcontrolledfrom19/to18 rejected; valid19/19reviewfollowedordinaryConfirm refusedexisting5bookings. Samepage reloadhistorytwooldcancelledonly/newreasonabsent,19Oct09–18 unchanged. Ownercalendardate19 still14c/e911/d730/064/f821 originaltimes; no auto-cancel/removalvisible. No newentity orfix,14same-livefixes remains. Datefill-only didn'tdeliverReactchange; normalkeyboardvalidated, notproductbug. staffTimeOffHttp1suite3supportingtestsPASS; foreignscope/race/fullpositive/rangebounds notPASS.

17:02stage043: Switched ordinaryGoogle pureclient→owner, business2currentconfirmed. Staffcard1bfd crashed reviews.forEach, sameRetrybeforecodefails; WB169 PostgRESTsingle/array/null adapter+thinroute fixes sameRetry. Actualoneeditedreview rating3/avg3.0 andschedulelinks rendered, no newdata/settings/grants.3suites14PASS/types99508/adapter8of8statements4of4functions11of11branches, scopedlint0errors1oldunusedwarning.14currentrunfixes/day10; fulltenant/RPC/responsive stillpartial. Stage044absenceconflicts next.

16:49stage042: Two ordinarypureclienttabs same12:15, first06458033confirmed, secondbusy/recoveredslots13:15/no duplicatevisible; warningstill3 vsfreshcabinet4 → WB168. Sharedavailabilityrefresh also refetchesenabledownquery, guestguard preserved. Sameworkflow13:15 afterfix createsf821dd52 once, stalesecondtoastbusy/modalclosed/count4→5 withoutreload/slots14:15+. Freshcabinet5uniquefutureconfirmed, package1unchanged. TwoLIVE TEST controlrecordsretained19Oct12:15–14:15 peruser.3suites15tests/types53826/refreshhook100%coveragePASS; newhooklintclean, oldviewimmutabilityFAIL unchanged.13currentrunfixes/day9; fullforeigntenant/RPC/multiuserload notproven. No commitpush/deletes.

16:40stage040/041: Controlledreload settledRU/KY retainedstaff/service (earlierHMR observation notfixedclaim). WB167 missingstep3/4 dictionaryguidance/availability/selectedlabels/price-summary fixedsameKYselected/unselectedstaff+service andENselected/RUservice. Original60min100–300unchanged, RUstep5restored, no bookingcreated.4suites33PASS/types94726/scopeddictionarylint18219PASS, overlappingpriorchecks; currentrun12fixes/day8. Stage042staleconflict next; allareaspartial and responsiveblocked.

16:32 stage039: WB165 step5 finaltitle/loadinghint/doublecolon and WB166 KYweekday targetedfixed. First Intl helper passedNode but livebrowser remainedRussian, so NOT counted until deterministic timezoneISOweekday+KYlabels repeated same19Oct selecteddate/summary/confirmation correctly. EN/RU unchanged, modal closed withoutnewbooking, RU restored.4suites30PASS/types/helper100%coverage; viewlint1oldHEADimmutabilityerror retained.11currentrunfixes/day7, notfullPASS. New observations: reload removedstaff/service, KYstep3/4 guidance/availabilitystillRussian; nextstage040. No data deletion/commit/push; responsive manualresize pending.

- Stage03816:14: клиент обычнымRepeat/день19Oct/слот11:15/Подтвердить создалd730afd0-8757-4cf4-90ac-66abfc1746aa confirmed11:15–12:15. В своёмкабинете3будущиезаписи, исходные2сохранены, пакет1/2неизменён. Новыйзанятыйинтервал исключён из свежегоспискаслотов, первыйдоступный12:15. WB164 исправлен пропущенныйсчётчик/русскийзаголовок предупреждения, тотжеUI RU/KY/EN и2→3,14целевыхтестов/types/lintPASS. Тест оставлен и занимает60мин. Перенос самимклиентом не найден, гонки/APIконфликты не пройдены. Другие остаточныепереводышага5/двойноедвоеточие записаныдляследующегоэтапа.

- Stage03716:03: повторная ограниченная попытка на новомbrowser2 тоже не даёт390CSS: фактически1560, затемreset1277×1648. Адаптивность BLOCKED, верстку по ложномуviewport не менял. Пользователю предложено вручную выставить телефон/планшет; доответа продолжать функциональные проверки. Данных/настроекпрофиля не менял.

- Stage035–03616:00: выбранный язык сохранялся, но первыйSSR былрусским. WB163 серверная локаль теперь передаётся общему провайдеру; тот же reloadEN/KY сразу показываетнужныйязык. WB162 русские пояснениепривязки/Telegramподсказка переведены и повтореныRU/KY/EN.19и43целевыхтеста пересекаются,typesPASS. Локальныйlintпровайдера неPASS:3старыеошибки1предупреждение подтвержденынаHEAD. Профиль/связи/уведомления/записи не менялись. Адаптивность остаётся непроверенной; следующая ограниченная попытка с фактическойCSSшириной на текущемbrowser2.

- Stage03415:45: отдельный клиент обычнымGoogleвходом; кабинеты владельца/сотрудника, финансысотрудника, скопированная ссылка ownerfinance и /admin закрыты, своястраницапрофиля открывается. WB160 экран отказа больше не предлагает менять базу и не показывает developerJSON; WB161 отказ сотрудника переведёнRU/KY/EN. Оба исправления повторены вживомUI,29целевыхтестов/typesPASS,lint0ошибок1старое предупреждение. Полная матрицачужихбизнесов/API/RPC/кадровая утечка ещё не проверена. Подозрение сброса языка после reload требует отдельного повтора безHMR, не объявлено исправленным. Тестовые сущности не менялись.

- Stage03315:25: сервер готов, пользователь обычной навигацией восстановил рабочую страницу. Живой переход бизнеса2→1 сохранился после обновления; поискe9111890 в бизнесе1 пуст, после возврата2 видна правильная подтверждённая бронь/клиент/филиал. Исходный выбор бизнеса восстановлен. Это ограниченныйPASS позитивной изоляции собственного кабинета, не полный контрольчужихролей/API/RPC и не адаптивность. Новых сущностей/исправлений нет; этап `stage-033-business-selection.json`.

- Пользователь возобновил работу; существующая автоматизация kezek переведена в ACTIVE до13:00UTC, завершение новых сценариев с12:40UTC. Утренний отчёт сохранён отдельно, старые исправления не считаются новыми.
- Начальная проверка15:17: обычная работа разрешена, текущий возвращённый недельный лимит0%, пятичасовой показатель не предоставлен.255существующихGit-записей сохранены.
- Сервер был остановлен. Запуск через Corepack упёрся в устаревший ключ проверки подписи; защиту не отключал. Использован уже установленный локальный Next, session61329/port3000/pid5992. Рабочая вкладка фактически на ошибке и заблокирована browserpolicy; пользователю предложено открыть новую обычную страницу. Ни нового livePASS, ни продуктового исправления на этом этапе ещё нет.

### 2026-10-13: автономное продолжение до 09:00 Бишкек

- Остановка около06:10 Бишкек: автоматизация kezek PAUSED, безопасно до исчерпания лимита (последняя проверка93%, обычная работа ещё разрешена). Четыре новых same-live исправления WB156–159; полный проект не PASS. Итог `apps/web/test-results/live-2026-10-13/final-report.md`, дальнейшая работа только после нового запроса пользователя.
- Stage032 / WB159: список бизнесов не закрывался Escape. После минимального исправления тот же живой сценарий повторён с кнопки и пункта списка: закрывается, фокус возвращается, бизнес не переключается.10целевыхтестов/types/локальныйlintPASS. Адаптивность BLOCKED: фактическая CSS-ширина не стала390 после настройки; override сброшен, визуальный мобильныйPASS не заявлен. Новых тестовых записей нет.

- Stage031 / WB158: поиск существующего клиента по актуальному имени профиля не работал, поemail показывал имяGoogle. Исправлен выбор отображаемого имени для уже доступной страницы аккаунтов, без расширения контактов/RLS. Тот же UI теперь находит LIVE TESTCLIENT12OCT поимени иemail.18целевыхтестов/coverage/typesPASS; новых записей нет. Поиск за пределами текущей страницы и полныйконтрольролей ещё непроверены.

- Stage030: отдельный клиент видит пакет `1/2`, завершённую `03469725` и корректные действия. Создал помеченный отзыв `eb51acab-1282-48f4-af87-11e1c5834fa7` с оценкой4, затем тем же интерфейсом обновил до3; после перезагрузки одна запись и точный новый текст сохранены. Отзыв оставлен по разрешению пользователя, может влиять на будущие рейтинговые агрегаты. WB157: подпись доступного редактирования исправлена и проверена RU/KY/EN;27целевыхтестов/types/lintпереводовPASS. Недействительная оценка, чужоеAPI, конкуренция и полноценные рейтинги/приватность остаются непроверенными.
- Общие проверки: полный Jest остановился по нехватке памяти (~4.1ГБ), общий lint —72ошибки167предупреждений; это не liveбаги продукта и не полныйPASS. Детали `checks-global.json`, без массовых исправлений и автоматического большого повтора.

- Stage029 / WB156: история владельца больше не обозначает связанный аккаунт как анонимного клиента. Имя восстановлено для прежней `03469725` и новой тестовой `e9111890-d6e9-4dc9-a400-f32067fc0cf4` (19 октября 10:00–11:00, оставлена). Проверка доступа и бизнес ограничивают выборку имён, RLS не расширена. 33 целевых теста и проверка типов прошли; весь проект не объявлен PASS.

- Новый журнал: `apps/web/test-results/live-2026-10-13/progress.json`; предыдущие результаты не засчитываются повторно.
- Stage028: владелец обычным Google-входом отметил посещение сохранённой тестовой брони `03469725-c5ba-4978-abfe-2179f19caeab` уже после её фактического времени. UI и адресное read-only чтение подтвердили `paid`; пакет `e485ccd9-c181-4eb2-a3be-3067ffaec350` списал ровно один визит: `2 → 1`. После обновления статус сохранился, повторных действий посещения нет. Это ограниченный PASS, не проверка конкуренции команд, возврата, истечения срока или реальной оплаты.
- Тестовые данные оставлены по распоряжению пользователя. Отображение выбранного существующего клиента как «Клиент у стойки» остаётся воспроизведённым пробелом; следующий этап — диагностика и повторная живая проверка после минимального исправления.

### 2026-09-17: уведомления о заявке сотрудника

- Telegram: сотрудник и владелец подтвердили получение. Обнаружена ссылка на внутренний `localhost`; исправление локального публичного адреса требует повторной проверки.
- WhatsApp владельца: канал включён и номер подтверждён; Meta отклонила запрос с `Parameter name is missing or empty`. По скриншоту утверждённого `kezek_staff_application_owner` подтверждены `business_name`, `applicant_name`; сопоставление добавлено в локальный `.env.local`. Автотест проверяет точный payload. Реальная повторная доставка ещё не проверена; шаблон Meta не изменён.
- Email: **BLOCKED**, не пройден. Resend вернул 403 `Domain not verified` для `mail.kezek.kg`; пользователь сообщил об истёкшей оплате домена. По согласованию email временно исключён из ручного прогона. Настройки пользователей и отправки не отключались. После восстановления домена: проверить DNS, статус Verified в Resend и реальную доставку обоим получателям.
- Заявка уже создана; не отклонять и не дублировать только ради повторной отправки уведомлений.
- Дополнительно: read-only Meta API подтвердил шаблон `961543886205288` как APPROVED/NAMED. Кнопка «Открыть заявки» имеет статический URL `https://kezek.kg/dashboard/role-applications`; пока домен не восстановлен, для локального теста кабинет открывать вручную через текущий туннель. Кнопку в Meta не меняли.

| Дата | Среда / commit | Роль | Этап | Результат | Примечание |
| --- | --- | --- | --- | --- | --- |
| 2026-09-02 | `http://localhost:3000` | `OWNER` | `03-04` | почти завершён | создание, привязка, удаление без записей, редактирование, валидация, длинное название и второй филиал подтверждены; публичную услугу проверим после создания сотрудника |

## Текущая передача пользователю

Следующее действие:

1. войти как `OWNER`;
2. в отдельном браузерном профиле или инкогнито войти как `STAFF-1`;
3. с публичной страницы отправить заявку стать сотрудником выбранного бизнеса;
4. вернуться как `OWNER` и одобрить заявку;
5. снова войти как `STAFF-1`, проверить новый кабинет и доступ к бизнесу;
6. после этого назначить филиал, услугу и рабочий график.

## Итог прогона

- Начат: 2026-09-02.
- Текущая точка: `04.3 Услуги`.
- Прогон завершён: нет.
- Release status: не определён.
