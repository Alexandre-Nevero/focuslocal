import {useId, useState} from "react";
import {CloseIcon} from "../components.tsx";

export function Sites({work, block, onAdd, onRemove}: {
    work: string[],
    block: string[],
    onAdd(role: "work" | "block", target: string): void,
    onRemove(target: string): void
}) {
    const [draft, setDraft] = useState("");
    const [role, setRole] = useState<"work" | "block">("work");
    const fieldId = useId();

    const add = () => {
        const value = draft.trim().toLowerCase();
        setDraft("");
        if (value !== "")
            onAdd(role, value);
    };

    const list = (items: string[], listRole: "work" | "block", title: string) => (
        <fieldset className="list-editor" data-role={listRole}>
            <legend>{title}</legend>
            {items.length > 0 && (
                <ul className="chips">
                    {items.map((item) => (
                        <li key={item} className="chip" data-role={listRole}>
                            <span>{item}</span>
                            <button
                                type="button"
                                className="chip-remove"
                                aria-label={`Remove ${item}`}
                                onClick={() => onRemove(item)}
                            >
                                <CloseIcon />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </fieldset>
    );

    return (
        <div className="sites">
            {list(work, "work", "Work")}
            {list(block, "block", "Block")}
            <div className="list-add">
                <label htmlFor={fieldId} className="field-label">Add a site or app</label>
                <div className="sites-add-row">
                    <select
                        aria-label="List"
                        value={role}
                        onChange={(e) => setRole(e.target.value as "work" | "block")}
                    >
                        <option value="work">Work</option>
                        <option value="block">Block</option>
                    </select>
                    <input
                        id={fieldId}
                        type="text"
                        value={draft}
                        placeholder="youtube.com"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                add();
                            }
                        }}
                    />
                    <button type="button" className="btn" onClick={add}>Add</button>
                </div>
            </div>
        </div>
    );
}
