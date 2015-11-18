class Dashing.Shared extends Dashing.Widget

  createChart: (seriesOptions) ->
    $('#shared').highcharts 'StockChart',
      title: text: 'Daily Shared Count'
      legend: enabled: true
      subtitle: text: 'includes: "Uploaded by Twitter", "youtu.be", "instagram.com", "vimeo.com", "vine.co"'
      rangeSelector:
        selected: 4
        allButtonsEnabled: true
        enable: true
      legend: enabled: true
      yAxis:
        plotLines: [ {
          value: 0
          width: 1
          color: 'silver'
        } ]
        min: 0
      plotOptions:
        series:
          lineWidth: 1
          events: legendItemClick: (event) ->
            index = @index

            # toggle current graph
            if @visible then @.hide() else @.show()

            # Renew local storage
            localStorage.setItem(@name, (if @visible then 'true' else 'false'))

            # Sync every graph
            chart = $('#mentioned, #shared, #retweeted, #followers, #favorited')
            chart.each ->
              c = $(@).highcharts()
              if c.series[index].visible then c.series[index].hide() else c.series[index].show()
              return
        spline:
          marker:
            enabled: true
      
      tooltip:
        pointFormat: '<span style="color:{series.color}">{series.name}</span>: {point.y}<br/>'
        valueDecimals: 0
      series: seriesOptions
    return

  onData: (data) ->
    legendDefault = {
      "tickleapp": true,
      "wonderworkshop": false,
      "spheroedu": false,
      "gotynker": false,
      "hopscotch": false,
      "codehs": false,
      "kodable": false,
      "codeorg": false,
      "scratch": false,
      "trinketapp": false
    }

    data = JSON.parse(data.data)
    data.map (x) ->
      storageVisibility = localStorage.getItem(x.name)
      if storageVisibility
        x.visible = if storageVisibility == 'true' then true else false
      else
        x.visible = legendDefault[x.name]

    @createChart(data)