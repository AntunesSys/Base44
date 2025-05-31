import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ResponsiveTable({ 
  columns, 
  data, 
  loading, 
  emptyMessage = "Nenhum dado encontrado",
  maxHeight = "600px" 
}) {
  return (
    <div className="w-full">
      <div 
        className="overflow-auto rounded-lg border bg-white shadow-sm"
        style={{ maxHeight }}
      >
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
            <TableRow>
              {columns.map((column, index) => (
                <TableHead 
                  key={index}
                  className={`${column.className || ''} whitespace-nowrap px-3 py-3 text-xs font-medium`}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length} 
                  className="h-32 text-center"
                >
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700" />
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length} 
                  className="h-32 text-center text-gray-500"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-gray-50">
                  {columns.map((column, colIndex) => (
                    <TableCell 
                      key={colIndex}
                      className={`${column.cellClassName || ''} px-3 py-2 text-sm whitespace-nowrap`}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}