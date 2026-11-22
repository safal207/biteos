import { useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardList, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { businessCases, discoveryExport, discoveryQuestions } from "./businessRegistry";
import { CatalogRevenueLab } from "./CatalogRevenueLab";
import type { DiscoveryAnswers } from "./businessRegistry";
import "./business.css";

const connectionLabel = {
  native: "Уже в ядре",
  "linked-demo": "Связано ссылкой",
  pilot: "Пилотная гипотеза",
  discovery: "Сбор исходных данных",
} as const;

export function BusinessHub() {
  const [selected, setSelected] = useState("robys");
  const [drafts, setDrafts] = useState<Record<string, DiscoveryAnswers>>({});
  const [exported, setExported] = useState(false);
  const current = businessCases.find((item) => item.id === selected)!;
  const answers = drafts[selected] ?? {};
  const completed = discoveryQuestions.filter((question) => answers[question.id]?.trim()).length;

  function changeAnswer(questionId: string, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [selected]: { ...previous[selected], [questionId]: value },
    }));
    setExported(false);
  }

  function exportDraft() {
    const data = discoveryExport(selected, answers);
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "biteos-discovery-" + selected + ".json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExported(true);
  }

  return (
    <main className="business-hub">
      <div className="business-shell">
        <header className="business-header">
          <a href="#" className="business-logo" aria-label="BiteOS, перейти к демодоставке">bite<span>os</span><i /></a>
          <div className="business-header-links">
            <a href="#"><ArrowLeft size={16} /> Доставка</a>
            <a href="#kiosk">Киоск <ArrowRight size={16} /></a>
          </div>
        </header>

        <section className="business-hero" aria-labelledby="business-title">
          <span className="business-eyebrow">BITEOS · BUSINESS DISCOVERY</span>
          <h1 id="business-title">Сначала потребности.<br/><em>Потом витрина и продажи.</em></h1>
          <p>Существующие проекты связаны в одном кабинете. Изучаем реальный спрос и экономику, прежде чем обещать рост прибыли.</p>
          <div className="business-hero-stats">
            <span><b>{businessCases.length}</b> клиентских кейсов</span>
            <span><b>1</b> единая анкета</span>
            <span><b>0</b> выдуманных продаж</span>
          </div>
        </section>

        <section className="business-section" aria-labelledby="business-projects">
          <div className="business-section-heading">
            <div><span className="business-eyebrow">01 / ИСХОДНЫЕ РЕШЕНИЯ</span><h2 id="business-projects">Клиенты и проекты</h2></div>
            <p>Статус показывает тип связи, а не готовность к реальной торговле.</p>
          </div>
          <div className="business-project-grid">
            {businessCases.map((item) => (
              <button
                type="button"
                className={"business-project" + (selected === item.id ? " selected" : "")}
                key={item.id}
                onClick={() => { setSelected(item.id); setExported(false); }}
                aria-pressed={selected === item.id}
              >
                <span className="business-project-top"><span className="business-pill">{connectionLabel[item.connection]}</span><ArrowRight size={18}/></span>
                <strong>{item.name}</strong>
                <small>{item.sector}</small>
                <p>{item.summary}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="business-workspace" aria-labelledby="business-current">
          <div className="business-workspace-head">
            <div><span className="business-eyebrow">02 / КАРТА БИЗНЕСА</span><h2 id="business-current">{current.name}</h2><p>{current.summary}</p></div>
            {current.url && current.linkLabel ? <a className="business-external" href={current.url} target={current.url.startsWith("https://") ? "_blank" : undefined} rel={current.url.startsWith("https://") ? "noopener noreferrer" : undefined}>{current.linkLabel}<ExternalLink size={16}/></a> : <span className="business-progress">Ссылка на проект пока не указана</span>}
          </div>
          <div className="business-facts">
            <div><h3>Уже существует</h3><ul>{current.existing.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>
            <div><h3>Ещё нужно подтвердить</h3><ul>{current.unknown.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>
          </div>
          <CatalogRevenueLab key={selected} businessId={selected} />
          <div className="business-discovery-head">
            <div><span className="business-eyebrow">06 / DISCOVERY ENGINE · ЧЕРНОВИК</span><h2>Собрать реальные потребности</h2></div>
            <span className="business-progress">{completed} из {discoveryQuestions.length}</span>
          </div>
          <p className="business-disclaimer"><ShieldCheck size={17}/> Ответы остаются только в памяти этой вкладки до экспорта. Они не передаются на сервер и не являются проверенными интервью или статистикой продаж.</p>
          <form className="business-form" onSubmit={(event) => { event.preventDefault(); exportDraft(); }}>
            {discoveryQuestions.map((question, index) => (
              <label className="business-question" key={question.id}>
                <span><b>{String(index + 1).padStart(2, "0")}</b> {question.title}</span>
                <small>{question.hint}</small>
                <textarea rows={3} value={answers[question.id] ?? ""} onChange={(event) => changeAnswer(question.id, event.target.value)} placeholder="Добавьте факты, источник данных или гипотезу…"/>
              </label>
            ))}
            <div className="business-actions">
              <button type="submit" className="business-download" disabled={completed === 0}><Download size={18}/> Экспортировать карту потребностей</button>
              <span role="status">{exported ? "Черновик сохранён в JSON-файл на устройстве." : "Сначала заполните хотя бы один ответ."}</span>
            </div>
          </form>
        </section>
        <footer className="business-footer"><ClipboardList size={16}/> Далее: подтверждение фактов владельцем → тест гипотез → витрина → измеренные продажи. Никаких реальных платежей или интеграции с POS в этом экране нет.</footer>
      </div>
    </main>
  );
}
