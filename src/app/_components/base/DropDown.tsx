"use client";

import React, { useState, useRef, useEffect } from "react";

import { ChevronDown } from "lucide-react";

type DropdownItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type DropdownProps = {
  buttonLabel: string;
  items: DropdownItem[];
  separatedLink?: DropdownItem;
  buttonBgColor?: string;
  buttonTextColor?: string;
  onSelect?: (label: string) => void;
  onButtonClick?: () => void; // Add this
};

export default function Dropdown({
  buttonLabel,
  items,
  separatedLink,
  buttonBgColor = "bg-white",
  buttonTextColor = "text-black",
  onSelect,
  onButtonClick,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setOpen((prev) => !prev);
    if (onButtonClick) onButtonClick(); // Call here
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleItemClick = (label: string, onClick?: () => void) => {
    setOpen(false);
    if (onClick) onClick();
    if (onSelect) onSelect(label);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className={`font-normal text-sm rounded-t-sm px-5 py-1.5 inline-flex items-center ${buttonBgColor} ${buttonTextColor}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {buttonLabel}
        <ChevronDown className="opacity-50 pl-2 h-5 w-5" />
      </button>

      {open && (
        <div className="absolute left-0 z-10 mt-2 w-44 origin-top-left rounded-lg bg-white divide-y divide-gray-100 shadow-sm dark:bg-gray-700 dark:divide-gray-600">
          <ul
            className="py-2 text-sm text-gray-700 dark:text-gray-200"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="dropdownDividerButton"
          >
            {items.map(({ label, href, onClick }, index) => (
              <li key={index}>
                {href ? (
                  <a
                    href={href}
                    className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                    role="menuitem"
                    onClick={(e) => {
                      e.preventDefault();
                      handleItemClick(label, onClick);
                    }}
                  >
                    {label}
                  </a>
                ) : (
                  <button
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                    role="menuitem"
                    onClick={() => handleItemClick(label, onClick)}
                  >
                    {label}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {separatedLink && (
            <div className="py-2">
              {separatedLink.href ? (
                <a
                  href={separatedLink.href}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-200 dark:hover:text-white"
                  role="menuitem"
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(separatedLink.label, separatedLink.onClick);
                  }}
                >
                  {separatedLink.label}
                </a>
              ) : (
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-200 dark:hover:text-white"
                  role="menuitem"
                  onClick={() => handleItemClick(separatedLink.label, separatedLink.onClick)}
                >
                  {separatedLink.label}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
