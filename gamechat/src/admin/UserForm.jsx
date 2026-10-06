import { useState } from "react";
import { buttonStyles, primaryButtonStyles, inputStyles } from "./adminStyles";

const createFields = [
    {
        name: "username",
        label: "Username",
        type: "text",
        required: true,
        minLength: 3,
        maxLength: 30
    },
    { name: "email", label: "Email address", type: "email", required: true },
    {
        name: "password",
        label: "Password",
        type: "password",
        required: true,
        minLength: 8,
        maxLength: 32
    }
];

const editFields = [
    {
        name: "username",
        label: "Username",
        type: "text",
        required: true,
        minLength: 3,
        maxLength: 30
    },
    { name: "email", label: "Email address", type: "email", required: true },
    { name: "firstName", label: "First name", type: "text", maxLength: 50 },
    { name: "lastName", label: "Last name", type: "text", maxLength: 50 },
    { name: "displayName", label: "Display name", type: "text", maxLength: 50 }
];

function UserForm({ user, creating, onSave, onClose }) {
    const [values, setValues] = useState({
        username: user?.username || "",
        email: user?.email || "",
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        displayName: user?.displayName || "",
        password: "",
        role: user?.role || "USER"
    });
    const [error, setError] = useState("");

    let fields = editFields;
    let submitLabel = "Save changes";

    if (creating) {
        fields = createFields;
        submitLabel = "Create user";
    }

    function handleFieldChange(event) {
        const fieldName = event.target.name;
        const fieldValue = event.target.value;

        setValues(previous => ({
            ...previous,
            [fieldName]: fieldValue
        }));
    }

    function handleSubmit(event) {
        event.preventDefault();

        try {
            onSave(values);
        } catch (error) {
            setError(error.message);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(field => (
                <label key={field.name} className="block text-sm text-gray-300">
                    {field.label}

                    <input
                        name={field.name}
                        type={field.type}
                        required={field.required}
                        minLength={field.minLength}
                        maxLength={field.maxLength}
                        value={values[field.name]}
                        onChange={handleFieldChange}
                        autoComplete={field.type === "password" ? "new-password" : "off"}
                        className={`${inputStyles} mt-2`}
                    />
                </label>
            ))}

            {creating && (
                <label className="block text-sm text-gray-300">
                    Role
                    <select
                        name="role"
                        value={values.role}
                        onChange={handleFieldChange}
                        className={`${inputStyles} mt-2`}
                    >
                        <option>USER</option>
                        <option>SUPERADMIN</option>
                    </select>
                </label>
            )}

            {error && (
                <p role="alert" className="text-sm text-red-300">
                    {error}
                </p>
            )}

            <p className="text-xs text-gray-500">
                Demo changes last until you reload. Passwords are never stored.
            </p>

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={buttonStyles} onClick={onClose}>
                    Cancel
                </button>

                <button type="submit" className={primaryButtonStyles}>
                    {submitLabel}
                </button>
            </div>
        </form>
    );
}

export default UserForm;
