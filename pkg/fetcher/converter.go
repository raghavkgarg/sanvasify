package fetcher

import (
	"context"
	"fmt"
	"os"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/compress"
	pqfile "github.com/apache/arrow-go/v18/parquet/file"
	"github.com/apache/arrow-go/v18/parquet/pqarrow"
	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

// appendToParquet appends scheme data to a parquet file.
// If the file exists, it reads all existing data, appends the new data, and rewrites the file.
// This is necessary because Parquet doesn't support true append operations.
// The function uses a temporary file and atomic rename to prevent corruption.
// Note: For large files, this approach loads everything into memory and may be slow.
func (f *Fetcher) appendToParquet(txtPath, parquetPath string) error {
	// Parse TXT file
	file, err := os.Open(txtPath)
	if err != nil {
		return err
	}
	defer file.Close()

	report, err := nav.ParseNAVReport(file)
	if err != nil {
		return err
	}

	// Flatten schemes
	var schemes []*nav.Scheme
	for _, strategy := range report.Strategies {
		for _, fundHouse := range strategy.FundHouses {
			schemes = append(schemes, fundHouse.Schemes...)
		}
	}

	if len(schemes) == 0 {
		return fmt.Errorf("no schemes found in report")
	}

	// Create Arrow schema
	schema := arrow.NewSchema(
		[]arrow.Field{
			{Name: "scheme_code", Type: arrow.BinaryTypes.String},
			{Name: "scheme_name", Type: arrow.BinaryTypes.String},
			{Name: "isin_div_payout_growth", Type: arrow.BinaryTypes.String},
			{Name: "isin_div_reinvestment", Type: arrow.BinaryTypes.String},
			{Name: "net_asset_value", Type: arrow.BinaryTypes.String},
			{Name: "repurchase_price", Type: arrow.BinaryTypes.String},
			{Name: "sale_price", Type: arrow.BinaryTypes.String},
			{Name: "date", Type: arrow.BinaryTypes.String},
			{Name: "strategy_name", Type: arrow.BinaryTypes.String},
			{Name: "fund_house_name", Type: arrow.BinaryTypes.String},
			{Name: "fund_type", Type: arrow.BinaryTypes.String},
			{Name: "fund_company", Type: arrow.BinaryTypes.String},
			{Name: "fund_strategy", Type: arrow.BinaryTypes.String},
			{Name: "distribution_option", Type: arrow.BinaryTypes.String},
			{Name: "purchase_mode", Type: arrow.BinaryTypes.String},
		},
		nil,
	)

	// Build Arrow record
	mem := memory.NewGoAllocator()
	builder := array.NewRecordBuilder(mem, schema)
	defer builder.Release()

	for _, s := range schemes {
		builder.Field(0).(*array.StringBuilder).Append(s.Code)
		builder.Field(1).(*array.StringBuilder).Append(s.Name)
		builder.Field(2).(*array.StringBuilder).Append(s.ISINDivPayoutGrowth)
		builder.Field(3).(*array.StringBuilder).Append(s.ISINDivReinvestment)
		builder.Field(4).(*array.StringBuilder).Append(s.NetAssetValue)
		builder.Field(5).(*array.StringBuilder).Append(s.RepurchasePrice)
		builder.Field(6).(*array.StringBuilder).Append(s.SalePrice)
		builder.Field(7).(*array.StringBuilder).Append(s.Date)
		builder.Field(8).(*array.StringBuilder).Append(s.StrategyName)
		builder.Field(9).(*array.StringBuilder).Append(s.FundHouseName)
		builder.Field(10).(*array.StringBuilder).Append(s.FundType)
		builder.Field(11).(*array.StringBuilder).Append(s.FundCompany)
		builder.Field(12).(*array.StringBuilder).Append(s.FundStrategy)
		builder.Field(13).(*array.StringBuilder).Append(s.DistributionOption)
		builder.Field(14).(*array.StringBuilder).Append(s.PurchaseMode)
	}

	record := builder.NewRecord()
	defer record.Release()

	// Check if file exists
	fileExists := false
	if _, err := os.Stat(parquetPath); err == nil {
		fileExists = true
	}

	if fileExists {
		// Read existing data
		pf, err := pqfile.OpenParquetFile(parquetPath, false)
		if err != nil {
			return err
		}
		defer pf.Close()

		rdr, err := pqarrow.NewFileReader(pf, pqarrow.ArrowReadProperties{}, memory.DefaultAllocator)
		if err != nil {
			return err
		}

		// Get existing schema
		existingSchema, err := rdr.Schema()
		if err != nil {
			return err
		}

		// Read all existing records
		var existingRecords []arrow.Record
		tbl, err := rdr.ReadTable(context.Background())
		if err != nil {
			return err
		}
		defer tbl.Release()

		tr := array.NewTableReader(tbl, 0)
		defer tr.Release()
		for tr.Next() {
			rec := tr.Record()
			rec.Retain()
			existingRecords = append(existingRecords, rec)
		}

		// Rebuild new record with existing schema
		builder := array.NewRecordBuilder(mem, existingSchema)
		defer builder.Release()

		for _, s := range schemes {
			builder.Field(0).(*array.StringBuilder).Append(s.Code)
			builder.Field(1).(*array.StringBuilder).Append(s.Name)
			builder.Field(2).(*array.StringBuilder).Append(s.ISINDivPayoutGrowth)
			builder.Field(3).(*array.StringBuilder).Append(s.ISINDivReinvestment)
			builder.Field(4).(*array.StringBuilder).Append(s.NetAssetValue)
			builder.Field(5).(*array.StringBuilder).Append(s.RepurchasePrice)
			builder.Field(6).(*array.StringBuilder).Append(s.SalePrice)
			builder.Field(7).(*array.StringBuilder).Append(s.Date)
			builder.Field(8).(*array.StringBuilder).Append(s.StrategyName)
			builder.Field(9).(*array.StringBuilder).Append(s.FundHouseName)
			builder.Field(10).(*array.StringBuilder).Append(s.FundType)
			builder.Field(11).(*array.StringBuilder).Append(s.FundCompany)
			builder.Field(12).(*array.StringBuilder).Append(s.FundStrategy)
			builder.Field(13).(*array.StringBuilder).Append(s.DistributionOption)
			builder.Field(14).(*array.StringBuilder).Append(s.PurchaseMode)
		}

		newRecord := builder.NewRecord()
		defer newRecord.Release()

		// Write all records (existing + new) to temp file
		tmpPath := parquetPath + ".tmp"
		out, err := os.Create(tmpPath)
		if err != nil {
			return err
		}

		props := parquet.NewWriterProperties(parquet.WithCompression(compress.Codecs.Snappy))
		writer, err := pqarrow.NewFileWriter(existingSchema, out, props, pqarrow.DefaultWriterProps())
		if err != nil {
			out.Close()
			return err
		}

		for _, rec := range existingRecords {
			if err := writer.Write(rec); err != nil {
				writer.Close()
				out.Close()
				return err
			}
			rec.Release()
		}

		if err := writer.Write(newRecord); err != nil {
			writer.Close()
			out.Close()
			return err
		}

		writer.Close()
		out.Close()

		// Replace original with temp
		return os.Rename(tmpPath, parquetPath)
	}

	// Create new file
	out, err := os.Create(parquetPath)
	if err != nil {
		return err
	}
	defer out.Close()

	props := parquet.NewWriterProperties(parquet.WithCompression(compress.Codecs.Snappy))
	writer, err := pqarrow.NewFileWriter(schema, out, props, pqarrow.DefaultWriterProps())
	if err != nil {
		return err
	}
	defer writer.Close()

	return writer.Write(record)
}
