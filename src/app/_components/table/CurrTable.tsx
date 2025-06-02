"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  Plus,
  Eye,
  EyeOff,
  Filter,
  Group,
  ArrowUpDown,
  Palette,
  Search,
  Grid3X3,
  Settings,
  Calendar,
  ImageIcon,
  Trello,
  TimerIcon as Timeline,
  List,
  GanttChart,
  PlusSquare,
  FileText,
  Check,
  CirclePlus
} from "lucide-react"
import TableView from "../base/Table";

type CurrTableProps = {
  tableId?: string | null;
};


export function CurrTable ({ tableId }: CurrTableProps) {
  const [viewsOpen, setViewsOpen] = useState(true)

  return (
    <div>
        <div>
        {/* Tools on top */}
        <div className="">
          <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setViewsOpen(!viewsOpen)}
            >
              <Eye className="w-4 h-4" />
              <span>Views</span>
            </button>

            <div className="h-4 w-px bg-gray-300"></div>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <Grid3X3 className="w-4 h-4" />
              <span>Grid view</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <EyeOff className="w-4 h-4" />
              <span>Hide fields</span>
            </button>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <Group className="w-4 h-4" />
              <span>Group</span>
            </button>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <ArrowUpDown className="w-4 h-4" />
              <span>Sort</span>
            </button>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <Palette className="w-4 h-4" />
              <span>Color</span>
            </button>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <CirclePlus className="w-4 h-4" />
              <span>Add 100K Rows</span>
            </button>
          </div>
        </div>
      </div>
        </div>

        {/* Main Content with Views Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Views Sidebar */}
        {viewsOpen && (
          <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
            {/* Search Bar */}
            <div className="p-2 border-b border-gray-200">
              <div className="flex items-center bg-gray-100 rounded px-2 py-1">
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Find a view"
                  className="bg-transparent border-none text-sm w-full focus:outline-none"
                />
                <button className="text-gray-400 hover:text-gray-600">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Views List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-1">
                <div className="flex items-center justify-between px-2 py-2 bg-blue-50 text-blue-600 rounded group">
                  <div className="flex items-center">
                    <Grid3X3 className="w-4 h-4 mr-2" />
                    <span className="text-sm">Grid view</span>
                  </div>
                  <Check className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Create Section */}
            <div className="border-t border-gray-200">
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-sm font-medium text-gray-700">Create...</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>

                {/* View Types */}
                <div className="mt-1 space-y-1">
                  {/* Grid */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <Grid3X3 className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Grid</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Calendar */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Calendar</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Gallery */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <ImageIcon className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Gallery</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Kanban */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <Trello className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Kanban</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <Timeline className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Timeline</span>
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* List */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <List className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">List</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Gantt */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <GanttChart className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Gantt</span>
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* New section */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <PlusSquare className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">New section</span>
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Form</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          {tableId ? (
            <TableView tableId={tableId} />
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-gray-500">
              <div className="text-center">
                <p className="text-lg">Please select a table</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
